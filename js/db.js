// =============================================
// db.js — 로컬(IndexedDB) 전용 CRUD
// 모든 데이터는 IDB에서 즉시 읽고/쓰기.
// =============================================

// ── SELECT ──

async function fetchTodosByDate(dateStr) {
  const all = await idbGetAll();
  return all
    .filter(t => t.date === dateStr)
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return (b.created_at || '') > (a.created_at || '') ? 1 : -1;
    });
}

async function fetchDotDatesForMonth(year, month) {
  const from = `${year}-${String(month).padStart(2,'0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  const all = await idbGetAll();

  // 일반 행 (반복 마스터 제외)
  const directDates = all
    .filter(t =>
      t.date >= from && t.date <= to &&
      !t.is_done &&
      !(t.repeat_deleted) &&
      (!t.repeat_type || t.repeat_type === 'none' || t.repeat_exception === true)
    )
    .map(t => t.date);

  // 반복 마스터 행 → 해당 월 날짜 중 매칭되는 날 계산
  const repeatMasters = all.filter(t =>
    t.repeat_type && t.repeat_type !== 'none' &&
    !t.repeat_master_id &&
    !t.repeat_exception &&
    t.date <= to
  );

  // 예외/삭제 행 세트
  const exceptions = all.filter(t =>
    t.date >= from && t.date <= to &&
    t.repeat_exception === true
  );
  const exceptionSet = new Set(exceptions.map(e => `${e.repeat_master_id}_${e.date}`));
  const deletedSet   = new Set(exceptions.filter(e => e.repeat_deleted).map(e => `${e.repeat_master_id}_${e.date}`));

  const repeatDates = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    for (const m of repeatMasters) {
      const key = `${m.id}_${dateStr}`;
      if (deletedSet.has(key)) continue;
      if (exceptionSet.has(key)) {
        // 예외 행이 있고 완료 안됐으면 점 표시
        const ex = exceptions.find(e => e.repeat_master_id === m.id && e.date === dateStr);
        if (ex && !ex.is_done && !ex.repeat_deleted) repeatDates.push(dateStr);
        continue;
      }
      if (isRepeatMatch(m, dateStr)) {
        repeatDates.push(dateStr);
        break;
      }
    }
  }

  return [...directDates, ...repeatDates];
}

// 과거 미완료 할일이 있는 날짜 목록 (오늘 제외 이전 날짜만)
async function fetchPastUndoneDatesForMonth(year, month) {
  const from = `${year}-${String(month).padStart(2,'0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  const today = todayStr();
  const all = await idbGetAll();

  // 일반 행: 과거 + 미완료
  const directDates = all
    .filter(t =>
      t.date >= from && t.date < today && t.date <= to &&
      !t.is_done &&
      !(t.repeat_deleted) &&
      (!t.repeat_type || t.repeat_type === 'none' || t.repeat_exception === true)
    )
    .map(t => t.date);

  // 반복 마스터: 과거 날짜 중 미완료
  const repeatMasters = all.filter(t =>
    t.repeat_type && t.repeat_type !== 'none' &&
    !t.repeat_master_id &&
    !t.repeat_exception &&
    t.date <= to
  );

  const exceptions = all.filter(t =>
    t.date >= from && t.date <= to &&
    t.repeat_exception === true
  );
  const exceptionSet = new Set(exceptions.map(e => `${e.repeat_master_id}_${e.date}`));
  const deletedSet   = new Set(exceptions.filter(e => e.repeat_deleted).map(e => `${e.repeat_master_id}_${e.date}`));

  const repeatDates = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (dateStr >= today) continue; // 오늘 이후는 제외
    for (const m of repeatMasters) {
      const key = `${m.id}_${dateStr}`;
      if (deletedSet.has(key)) continue;
      if (exceptionSet.has(key)) {
        const ex = exceptions.find(e => e.repeat_master_id === m.id && e.date === dateStr);
        if (ex && !ex.is_done && !ex.repeat_deleted) repeatDates.push(dateStr);
        continue;
      }
      if (isRepeatMatch(m, dateStr)) {
        repeatDates.push(dateStr);
        break;
      }
    }
  }

  return [...new Set([...directDates, ...repeatDates])];
}

async function searchTodos(keyword) {
  const all = await idbGetAll();
  const kw = keyword.toLowerCase();
  return all
    .filter(t =>
      (t.title || '').toLowerCase().includes(kw) ||
      (t.memo  || '').toLowerCase().includes(kw)
    )
    .sort((a, b) => {
      if (a.date !== b.date) return b.date > a.date ? 1 : -1;
      return (b.created_at || '') > (a.created_at || '') ? 1 : -1;
    });
}

// ── INSERT ──

async function insertTodo(data) {
  const minOrder = AppState.todos.length > 0
    ? Math.min(...AppState.todos.map(t => t.sort_order)) - 1
    : 0;

  const now = new Date().toISOString();
  const todo = {
    id:               newId(),
    title:            data.title || '',
    memo:             data.memo  || '',
    importance:       data.importance ?? 0,
    date:             data.date  || todayStr(),
    remind_days:      data.remind_days ?? 0,
    weekly_flag:      data.weekly_flag ?? false,
    is_done:          false,
    sort_order:       minOrder,
    repeat_type:      data.repeat_type     || 'none',
    repeat_interval:  data.repeat_interval || 1,
    repeat_day:       data.repeat_day      || null,
    repeat_end_date:  data.repeat_end_date || null,
    repeat_meta:      data.repeat_meta     || null,
    repeat_master_id: null,
    repeat_exception: false,
    checklist:        data.checklist       || null,
    created_at:       now,
    updated_at:       now,
  };

  await idbPut(todo);
  return todo;
}

async function insertRemindCopy(original, remindDate, dateLabel) {
  const titleSuffix = dateLabel ? `(${dateLabel})` : '';
  const now = new Date().toISOString();
  const todo = {
    id:          newId(),
    title:       `🔔 ${original.title}${titleSuffix}`,
    memo:        original.memo || '',
    importance:  original.importance,
    date:        remindDate,
    remind_days: 0,
    is_done:     false,
    sort_order:  0,
    weekly_flag: false,
    repeat_type: 'none',
    repeat_interval: 1,
    repeat_day:  null,
    repeat_end_date: null,
    repeat_meta: null,
    repeat_master_id: null,
    repeat_exception: false,
    checklist:   null,
    created_at:  now,
    updated_at:  now,
  };

  await idbPut(todo);
  return todo;
}

// ── UPDATE ──

async function updateTodo(id, data) {
  const now = new Date().toISOString();
  const existing = await idbGet(id);
  if (!existing) return;
  await idbPut({ ...existing, ...data, updated_at: now });
}

async function toggleDone(id, isDone) {
  return updateTodo(id, {
    is_done: isDone,
    done_at: isDone ? new Date().toISOString() : null
  });
}

async function moveTodoDate(id, newDate) {
  return updateTodo(id, { date: newDate, sort_order: 0 });
}

async function updateSortOrders(todos) {
  return Promise.all(todos.map((t, i) => updateTodo(t.id, { sort_order: i })));
}

// ── DELETE ──

async function deleteTodo(id) {
  await idbDelete(id);
}

// ── 반복 관련 ──

async function fetchRepeatMasters(dateStr) {
  try {
    const all = await idbGetAll();
    return all.filter(t =>
      t.repeat_type && t.repeat_type !== 'none' &&
      t.date <= dateStr &&
      !t.repeat_master_id &&
      !t.repeat_exception
    );
  } catch(e) { return []; }
}

async function fetchRepeatExceptions(dateStr) {
  try {
    const all = await idbGetAll();
    return all.filter(t => t.date === dateStr && t.repeat_exception === true);
  } catch(e) { return []; }
}

// ── 반복 마스터 완전 소멸 체크 후 삭제 ──
// 유한 반복(repeat_end_date 있음)에서 모든 유효 날짜가 repeat_deleted 처리됐으면 마스터 삭제
async function checkAndCleanMaster(masterId) {
  const all = await idbGetAll();
  const master = all.find(t => String(t.id) === String(masterId));
  if (!master) return;

  // 종료일 없는 무한 반복은 판단 불가 → 유지
  if (!master.repeat_end_date) return;

  const start = new Date(master.date + 'T00:00:00');
  const end   = new Date(master.repeat_end_date + 'T00:00:00');

  const deletedDates = new Set(
    all
      .filter(t => String(t.repeat_master_id) === String(masterId) && t.repeat_deleted)
      .map(t => t.date)
  );

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = toLocalDateStr(d);
    if (isRepeatMatch(master, dateStr) && !deletedDates.has(dateStr)) {
      return; // 아직 살아있는 날짜 있음 → 마스터 유지
    }
  }

  // 모두 삭제됨 → 마스터 행 완전 삭제
  await deleteRepeatAll(masterId);
}

// ── 반복 일정 삭제 3종 ──

// 1. 이 날짜만 삭제: repeat_deleted 예외 행 생성 후 마스터 소멸 체크
async function deleteRepeatOnlyDate(masterId, dateStr) {
  const all = await idbGetAll();
  const existing = all.find(t =>
    String(t.repeat_master_id) === String(masterId) && t.date === dateStr && t.repeat_exception
  );

  if (existing) {
    await updateTodo(existing.id, { repeat_deleted: true });
  } else {
    const master = all.find(t => String(t.id) === String(masterId));
    const now = new Date().toISOString();
    const exception = {
      id:               newId(),
      title:            master?.title || '',
      memo:             master?.memo  || '',
      importance:       master?.importance || 0,
      date:             dateStr,
      remind_days:      0,
      is_done:          false,
      sort_order:       0,
      weekly_flag:      false,
      repeat_type:      'none',
      repeat_interval:  1,
      repeat_day:       null,
      repeat_end_date:  null,
      repeat_meta:      null,
      repeat_master_id: masterId,
      repeat_exception: true,
      repeat_deleted:   true,
      checklist:        null,
      created_at:       now,
      updated_at:       now,
    };
    await idbPut(exception);
  }

  // 유한 반복에서 모든 날짜 삭제됐으면 마스터도 삭제
  await checkAndCleanMaster(masterId);
}

// 2. 이 날짜 이후 삭제
async function deleteRepeatFromDate(masterId, dateStr) {
  const all = await idbGetAll();
  const master = all.find(t => String(t.id) === String(masterId));

  // dateStr이 마스터 시작일 이하면 → 유효 날짜가 하나도 안 남음 → 전체 삭제
  if (master && dateStr <= master.date) {
    await deleteRepeatAll(masterId);
    return;
  }

  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const endDate = toLocalDateStr(d);

  await updateTodo(masterId, { repeat_end_date: endDate });

  // 이후 예외 행들 삭제
  const all2 = await idbGetAll();
  const toDeletes = all2.filter(t =>
    String(t.repeat_master_id) === String(masterId) && t.date >= dateStr
  );
  await Promise.all(toDeletes.map(t => deleteTodo(t.id)));

  // 시작일~종료일 사이에 유효 날짜가 모두 삭제됐으면 마스터도 삭제
  await checkAndCleanMaster(masterId);
}

// 3. 전체 삭제: 마스터 + 모든 예외 행
async function deleteRepeatAll(masterId) {
  const all = await idbGetAll();
  const toDeletes = all.filter(t =>
    String(t.id) === String(masterId) || String(t.repeat_master_id) === String(masterId)
  );
  await Promise.all(toDeletes.map(t => idbDelete(t.id)));
}

async function insertRepeatException(masterId, dateStr, isDone = false) {
  // 마스터 행은 AppState 또는 IDB에서 찾기
  let master = AppState.todos.find(t => t.id === masterId || t._masterId === masterId);
  if (!master) {
    try { master = await idbGet(masterId); } catch(e) {}
  }
  const now = new Date().toISOString();
  const exception = {
    id:               newId(),
    title:            master?.title || '',
    memo:             master?.memo  || '',
    importance:       master?.importance || 0,
    weekly_flag:      master?.weekly_flag || false,
    checklist:        master?.checklist   || null,
    date:             dateStr,
    remind_days:      0,
    is_done:          isDone,
    done_at:          isDone ? now : null,
    sort_order:       0,
    repeat_type:      'none',
    repeat_interval:  1,
    repeat_day:       null,
    repeat_end_date:  null,
    repeat_meta:      null,
    repeat_master_id: masterId,
    repeat_exception: true,
    created_at:       now,
    updated_at:       now,
  };

  await idbPut(exception);
  return exception;
}

// ── 반복 수정 3종 ──

// 1. 이 날짜만 수정: 예외 행 생성/업데이트
async function updateRepeatOnlyDate(masterId, dateStr, data) {
  const all = await idbGetAll();
  const existing = all.find(t =>
    String(t.repeat_master_id) === String(masterId) && t.date === dateStr && t.repeat_exception
  );

  if (existing) {
    await updateTodo(existing.id, data);
  } else {
    const master = all.find(t => String(t.id) === String(masterId));
    const now = new Date().toISOString();
    const exception = {
      id:               newId(),
      title:            data.title            ?? master?.title ?? '',
      memo:             data.memo             ?? master?.memo  ?? '',
      importance:       data.importance       ?? master?.importance ?? 0,
      weekly_flag:      data.weekly_flag      ?? master?.weekly_flag ?? false,
      checklist:        data.checklist        ?? master?.checklist ?? null,
      date:             dateStr,
      remind_days:      data.remind_days      ?? 0,
      is_done:          false,
      sort_order:       0,
      repeat_type:      'none',
      repeat_interval:  1,
      repeat_day:       null,
      repeat_end_date:  null,
      repeat_meta:      null,
      repeat_master_id: masterId,
      repeat_exception: true,
      created_at:       now,
      updated_at:       now,
    };
    await idbPut(exception);
  }
}

// 2. 이 날짜 이후 모두 수정: 마스터 종료일을 dateStr-1로 자르고, 새 마스터 생성
async function updateRepeatFromDate(masterId, dateStr, data) {
  const all = await idbGetAll();
  const master = all.find(t => String(t.id) === String(masterId));
  if (!master) return;

  // 현재 마스터를 dateStr 하루 전으로 종료
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const endDate = toLocalDateStr(d);

  if (dateStr <= master.date) {
    // 이 날짜가 시작일 이전이면 전체 수정과 동일
    await updateRepeatAll(masterId, data);
    return;
  }

  await updateTodo(masterId, { repeat_end_date: endDate });

  // dateStr 이후 예외 행 삭제
  const all2 = await idbGetAll();
  const toDeletes = all2.filter(t =>
    String(t.repeat_master_id) === String(masterId) && t.date >= dateStr
  );
  await Promise.all(toDeletes.map(t => deleteTodo(t.id)));

  // 새 마스터 행 생성
  const now = new Date().toISOString();
  const newMaster = {
    id:               newId(),
    title:            data.title           ?? master.title,
    memo:             data.memo            ?? master.memo ?? '',
    importance:       data.importance      ?? master.importance ?? 0,
    weekly_flag:      data.weekly_flag     ?? master.weekly_flag ?? false,
    checklist:        data.checklist       ?? master.checklist ?? null,
    date:             dateStr,
    remind_days:      data.remind_days     ?? master.remind_days ?? 0,
    is_done:          false,
    sort_order:       master.sort_order ?? 0,
    repeat_type:      data.repeat_type     ?? master.repeat_type,
    repeat_interval:  data.repeat_interval ?? master.repeat_interval ?? 1,
    repeat_day:       data.repeat_day      ?? master.repeat_day ?? null,
    repeat_end_date:  data.repeat_end_date ?? master.repeat_end_date ?? null,
    repeat_meta:      data.repeat_meta     ?? master.repeat_meta ?? null,
    repeat_master_id: null,
    repeat_exception: false,
    created_at:       now,
    updated_at:       now,
  };
  await idbPut(newMaster);
  return newMaster;
}

// 3. 전체 수정: 모든 예외 행 삭제 후 마스터 업데이트
async function updateRepeatAll(masterId, data) {
  const all = await idbGetAll();

  // 모든 예외 행 삭제
  const exceptions = all.filter(t => String(t.repeat_master_id) === String(masterId));
  await Promise.all(exceptions.map(t => deleteTodo(t.id)));

  // 마스터 업데이트
  await updateTodo(masterId, data);
}

// ── 체크리스트 완료 여부 판단 ──
function hasChecklist(todo) {
  if (!todo.checklist) return false;
  try {
    const items = JSON.parse(todo.checklist);
    return Array.isArray(items) && items.some(it => it.text && it.text.trim());
  } catch(e) { return false; }
}

function isChecklistComplete(todo) {
  if (!hasChecklist(todo)) return true;
  try {
    const items = JSON.parse(todo.checklist);
    const valid = items.filter(it => it.text && it.text.trim());
    return valid.length > 0 && valid.every(it => it.checked);
  } catch(e) { return false; }
}

function getChecklistProgress(todo) {
  if (!hasChecklist(todo)) return null;
  try {
    const items = JSON.parse(todo.checklist);
    const valid = items.filter(it => it.text && it.text.trim());
    if (!valid.length) return null;
    const done = valid.filter(it => it.checked).length;
    return { done, total: valid.length };
  } catch(e) { return null; }
}
