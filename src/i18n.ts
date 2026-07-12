export type AppLocale = "en" | "ru";

function formatRuYearCount(count: number): string {
  const abs = Math.abs(count);
  const lastTwo = abs % 100;
  const lastOne = abs % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return "лет";
  }

  if (lastOne === 1) {
    return "год";
  }

  if (lastOne >= 2 && lastOne <= 4) {
    return "года";
  }

  return "лет";
}

function formatRuDayCount(count: number): string {
  const abs = Math.abs(count);
  const lastTwo = abs % 100;
  const lastOne = abs % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return "дней";
  }

  if (lastOne === 1) {
    return "день";
  }

  if (lastOne >= 2 && lastOne <= 4) {
    return "дня";
  }

  return "дней";
}

export interface AppLabels {
  audit: {
    actions: Record<string, string>;
    changedPrefix: string;
    fields: Record<string, string>;
    resultPrefix: string;
    results: Record<string, string>;
    snoozedForMinutes: (minutes: number) => string;
    unknownActor: string;
  };
  auditModal: {
    actor: string;
    empty: string;
    loading: string;
    title: string;
  };
  common: {
    back: string;
    loading: string;
    next: string;
    refresh: string;
    unknownError: string;
  };
  account: {
    admin: string;
    currentUser: string;
    logout: string;
    participant: string;
    timezone: string;
    timezoneDescription: string;
    timezoneHint: string;
    timezoneSaved: string;
    timezoneTitle: string;
    useBrowserTimezone: string;
    user: string;
  };
  auth: {
    loginDescription: string;
    loginTitle: string;
  };
  api: {
    errors: Record<string, string>;
    fallbacks: {
      actionFailed: string;
      addUserFailed: string;
      badResponse: string;
      configFailed: string;
      createAnnualEventFailed: string;
      createTaskFailed: string;
      deactivateUserFailed: string;
      deleteAnnualEventFailed: string;
      deletePreviewFailed: string;
      deleteTaskFailed: string;
      exportFailed: string;
      getAssigneesFailed: string;
      getAuditFailed: string;
      getCurrentUserFailed: string;
      getAnnualEventsFailed: string;
      getHistoryFailed: string;
      getTasksFailed: string;
      getUsersFailed: string;
      monthlyUpdateFailed: string;
      runCleanupFailed: string;
      updateTimezoneFailed: string;
      updateTaskFailed: string;
      weeklyUpdateFailed: string;
      cleanupPreviewFailed: string;
    };
  };
  dates: {
    intlLocale: string;
  };
  history: {
    allStatuses: string;
    cancelled: string;
    description: string;
    done: string;
    doneLate: string;
    empty: string;
    familyScope: string;
    filteredEmpty: string;
    loading: string;
    loadFailed: string;
    missed: string;
    myScope: string;
    records: (start: number, end: number, total: number) => string;
    statusFilterLabel: string;
    title: string;
    toolbarLabel: string;
  };
  maintenance: {
    cleanupButton: string;
    cleanupDone: (notificationLogDeleted: number, telegramMessageRefsDeleted: number) => string;
    cleanupError: string;
    cleanupPreviewError: string;
    cleanupTitle: string;
    description: string;
    downloadButton: string;
    downloadDone: string;
    downloadError: string;
    downloading: string;
    exportDescription: string;
    exportTitle: string;
    olderThanDays: (days: number, count: number) => string;
    previewButton: string;
    previewIntro: string;
    previewUntil: (value: string) => string;
    safeCleanupNote: string;
    title: string;
  };
  navigation: {
    appSections: string;
    events: string;
    history: string;
    settings: string;
    tasks: string;
  };
  annualEvents: {
    created: string;
    createTitle: string;
    dateLabel: string;
    day: string;
    deleted: string;
    deleteConfirm: string;
    description: string;
    empty: string;
    emptyFamily: string;
    emptyMy: string;
    eventYear: string;
    eventYearHint: string;
    eventYearWithCount: (year: number, count: number) => string;
    loadFailed: string;
    listLabel: string;
    loading: string;
    familyTab: string;
    myTab: string;
    month: string;
    nextNotification: string;
    noNextNotification: string;
    recipients: string;
    recipientsRequired: string;
    records: (start: number, end: number, total: number) => string;
    reminderTime: string;
    title: string;
    titleField: string;
    titleRequired: string;
  };
  scheduleTypes: {
    monthly: string;
    oneTime: string;
    oneTimeWindow: string;
    weekly: string;
  };
  statuses: {
    active: string;
    cancelled: string;
    done: string;
    doneLate: string;
    missed: string;
    overdue: string;
  };
  taskCloseConfirm: {
    cancelled: string;
    completeLateTitle: string;
    completeTitle: string;
    confirmComplete: string;
    confirmMissed: string;
    missedTitle: string;
    recurringCompleteDescription: string;
    recurringMissedDescription: string;
    singleCompleteDescription: string;
    singleMissedDescription: string;
  };
  settings: {
    maintenance: string;
    tabsLabel: string;
    title: string;
    users: string;
  };
  tasks: {
    alreadyChanged: string;
    created: string;
    description: string;
    emptyFamily: string;
    emptyMy: string;
    familyTab: string;
    loadFailed: string;
    listLabel: string;
    myTab: string;
    refreshed: string;
    title: string;
    updated: string;
    deleted: string;
  };
  telegram: {
    adminUsers: {
      accessDenied: string;
      addButton: string;
      addCancelled: string;
      addPrompt: string;
      addPromptWithExample: string;
      added: (name: string, telegramUserId: number) => string;
      adminOnly: string;
      deactivate: (name: string) => string;
      deactivated: (name: string, telegramUserId: number) => string;
      deactivateAdminOnly: string;
      empty: string;
      invalidUser: string;
      notFoundOrCannotDeactivate: string;
      statusActive: string;
      statusDisabled: string;
      statusLabel: string;
      title: (count: number) => string;
      userAdminRole: string;
    };
    assigneeModes: {
      all: string;
      selected: string;
      self: string;
    };
    aiTaskDraft: {
      assigneeAll: string;
      assigneeSelf: string;
      buttons: {
        cancel: string;
        create: string;
      };
      cancelled: string;
      createFailed: string;
      dateIssues: {
        date_in_past: string;
        invalid_date: string;
        invalid_end_date: string;
        invalid_start_date: string;
        window_end_in_past: string;
        window_start_after_end: string;
      };
      fields: {
        assignees: string;
        date: string;
        missing: string;
        reminderTime: string;
        taskType: string;
        title: string;
        window: string;
      };
      invalidAssignee: string;
      missingFields: Record<string, string>;
      notTask: string;
      selectAssignees: string;
      prompts: {
        assignee: string;
        date: string;
        windowEndDate: string;
        windowStartDate: string;
        reminderTime: string;
        title: string;
      };
      title: string;
      taskTypeOneTime: string;
      taskTypeOneTimeWindow: string;
      expired: string;
    };
    buttons: {
      cancel: string;
      confirmRecreate: string;
      confirmDelete: string;
      currentAndFuture: string;
      deleteTask: string;
      done: string;
      doneSelection: string;
      edit: string;
      futureOnly: string;
      keepTask: string;
      missed: string;
      snoozeOneHour: string;
    };
    createPrompts: {
      cancelled: string;
      chooseAssignees: string;
      chooseMonthlyMode: string;
      chooseTaskType: string;
      chooseWeekday: string;
      createdMonthly: (title: string, assignees: string, window: string, reminder: string) => string;
      createdOneTime: (title: string, assignees: string, due: string, reminder: string) => string;
      createdOneTimeWindow: (title: string, assignees: string, window: string, reminder: string) => string;
      createdWeekly: (title: string, assignees: string, weekday: string, reminder: string, due: string) => string;
      createAgain: string;
      dailyReminderTime: string;
      dueDate: string;
      dueDateFuture: string;
      endPlusStartWindow: string;
      invalidMonthlyMode: string;
      invalidOneTimeWindow: string;
      invalidTaskType: string;
      invalidTitle: string;
      invalidDueDate: string;
      invalidTime: string;
      lastDaysWindow: string;
      missingCreateData: string;
      monthlyFixedWindow: string;
      nextDueFailed: string;
      oneTimeWindow: string;
      oneTimeWindowEndFuture: string;
      reminderTime: string;
      reset: string;
      selectedAssigneesUnavailable: string;
      selectAssignees: string;
      selectAssigneesByButtons: string;
      selectAtLeastOneAssignee: string;
      assigneeSummary: {
        all: (count: number) => string;
        selected: (count: number) => string;
        self: string;
      };
      title: string;
      useMenuOrStart: string;
    };
    editPrompts: {
      assigneesChanged: (assignees: string) => string;
      applyMonthlyAssignees: string;
      applyWeeklyAssignees: string;
      cancelled: string;
      chooseField: string;
      chooseFieldFor: (title: string) => string;
      chooseNewWeekday: string;
      dueAtChanged: (due: string) => string;
      dueAtOnlyOneTime: string;
      editDataMissing: string;
      invalidDueDate: string;
      invalidTaskType: string;
      invalidTime: string;
      invalidTitle: string;
      monthlyOnly: string;
      monthlyScheduleReadFailed: string;
      monthlyWindowChanged: (window: string, time: string) => string;
      newDueDate: string;
      newReminderTime: string;
      newTitle: string;
      notActual: string;
      oneTimeWindowWebOnly: string;
      recurringTimeOnly: string;
      reminderTimeChanged: (time: string) => string;
      reminderTimeOnlyRegularOneTime: string;
      scheduleConfirm: (lines: string[]) => string;
      scheduleFallback: string;
      taskTypeNotEditable: string;
      titleChanged: (title: string) => string;
      weekdayChanged: (weekday: string, time: string) => string;
      weekdayOnlyWeekly: string;
      weeklyScheduleReadFailed: string;
      windowSummary: {
        fixed: (startDay: number, endDay: number) => string;
        endPlusStart: (lastDays: number, firstDays: number) => string;
      };
    };
    deleteConfirm: {
      recurringDescription: string;
      recurringTitle: string;
      singleDescription: string;
      singleTitle: string;
    };
    fields: {
      assignees: string;
      dueAt: string;
      reminderTime: string;
      status: string;
      taskType: string;
      title: string;
      weekday: string;
      window: string;
    };
    menu: {
      createTask: string;
      familyTasks: string;
      myTasks: string;
      users: string;
    };
    messages: {
      emptyFamilyTasks: string;
      emptyMyTasks: string;
      menuTitle: string;
      start: string;
    };
    notifications: {
      annualEvent: (title: string, eventDate: string, offsetDays: number) => string;
      reminder: (title: string, dueAt: string) => string;
    };
    notices: {
      cancelled: string;
      deleteCancelled: string;
      deleted: string;
      done: string;
      invalidTask: string;
      missed: string;
      notFoundOrClosed: string;
      notFoundOrClosedOrNotOverdue: string;
      snoozedOneHour: string;
    };
    results: {
      cancelled: (title: string) => string;
      deleteCancelled: string;
      deletedInstance: (title: string) => string;
      deletedRule: (title: string) => string;
      done: (title: string) => string;
      missed: (title: string) => string;
      snoozed: (title: string, time: string) => string;
    };
    monthlyModes: {
      endPlusStart: string;
      fixed: string;
      lastDays: string;
    };
    taskTypes: {
      fallback: string;
      monthly: string;
      oneTime: string;
      oneTimeWindow: string;
      weekly: string;
    };
    taskList: {
      countLabel: (count: number) => string;
      overdue: string;
      total: string;
      updated: string;
    };
    statuses: {
      active: string;
      overdue: string;
    };
    weekdaysShort: string[];
  };
  users: {
    activate: string;
    active: string;
    addActivate: string;
    addedOrActivated: string;
    addFailed: string;
    deactivate: string;
    deactivated: string;
    deactivateFailed: string;
    description: string;
    disabled: string;
    empty: string;
    inputLabel: string;
    invalidTelegramId: string;
    loadFailed: string;
    loading: string;
    participant: string;
    title: string;
    userActivated: string;
  };
  web: {
    actions: {
      cancel: string;
      chooseAll: string;
      complete: string;
      create: string;
      creating: string;
      delete: string;
      deleting: string;
      edit: string;
      keep: string;
      miss: string;
      save: string;
      saving: string;
      unchooseAll: string;
    };
    createModes: {
      deadline: string;
      monthlyFixed: string;
      monthlyLastDays: string;
      weekly: string;
      window: string;
    };
    delete: {
      confirm: string;
      recurringDescription: string;
      recurringTitle: string;
      singleDescription: string;
      singleTitle: string;
    };
    fields: {
      applyAssignees: string;
      assignees: string;
      closedAt: string;
      closedBy: string;
      dueAt: string;
      endDay: string;
      firstDays: string;
      lastDays: string;
      reminderTime: string;
      startDay: string;
      taskType: string;
      title: string;
      weekday: string;
      window: string;
      windowEnd: string;
      windowStart: string;
    };
    messages: {
      assignedToYou: string;
      applyAssigneesCurrentAndFuture: string;
      applyAssigneesFutureOnly: string;
      datesInTimezone: (timezone: string) => string;
      loadingAssignees: string;
      loadingTasks: string;
      checking: string;
    };
    validation: {
      assigneesRequired: string;
      createFailed: string;
      dueDateRequired: string;
      invalidDueDate: string;
      invalidWindowDates: string;
      loadingAssigneesFailed: string;
      noChanges: string;
      reminderTimeRequired: string;
      title: string;
      updateFailed: string;
      windowRequired: string;
      monthlyLastWindowRequired: string;
    };
  };
  weekdays: string[];
}

const RU_LABELS: AppLabels = {
  audit: {
    actions: {
      "task.cancelled": "Задача отменена",
      "task.completed": "Отмечена выполненной",
      "task.created": "Задача создана",
      "task.deleted": "Задача удалена",
      "task.missed": "Отмечена пропущенной",
      "task.snoozed": "Напоминание отложено",
      "task.updated": "Задача изменена"
    },
    changedPrefix: "Изменено",
    fields: {
      assignees: "исполнители",
      due_at: "срок",
      reminder_time: "напоминание",
      schedule: "расписание",
      title: "название",
      weekday: "день недели",
      window: "окно выполнения"
    },
    resultPrefix: "Результат",
    results: {
      cancelled: "отменена",
      deleted_instance: "удалена",
      deleted_rule: "повторение удалено",
      done: "выполнена",
      done_late: "выполнена с опозданием",
      missed: "пропущена",
      snoozed: "отложена"
    },
    snoozedForMinutes: (minutes) => `Отложено на ${minutes} мин.`,
    unknownActor: "Неизвестно"
  },
  auditModal: {
    actor: "Кто",
    empty: "Действий пока нет.",
    loading: "Загрузка действий...",
    title: "Последние действия"
  },
  common: {
    back: "Назад",
    loading: "Загрузка...",
    next: "Дальше",
    refresh: "Обновить",
    unknownError: "Неизвестная ошибка."
  },
  account: {
    admin: "Админ",
    currentUser: "Текущий пользователь",
    logout: "Выйти",
    participant: "Участник",
    timezone: "Часовой пояс",
    timezoneDescription: "Используется для отображения дат и создания новых задач. Существующие задачи не пересчитываются.",
    timezoneHint: "IANA timezone, например Europe/Kyiv или America/New_York.",
    timezoneSaved: "Часовой пояс сохранен.",
    timezoneTitle: "Изменить часовой пояс",
    useBrowserTimezone: "Взять из браузера",
    user: "Пользователь"
  },
  auth: {
    loginDescription: "Используй тот же Telegram-аккаунт, который добавлен в семейного бота.",
    loginTitle: "Вход в Family Reminder"
  },
  api: {
    errors: {
      due_at_in_past: "Дата и время срока должны быть в будущем.",
      invalid_annual_event: "Проверьте название, дату, время уведомления и получателей события.",
      invalid_timezone: "Введите корректный IANA timezone, например Europe/Kyiv.",
      invalid_assignees: "Выберите хотя бы одного исполнителя.",
      invalid_available_from: "Введите корректную дату начала окна.",
      invalid_due_at: "Введите корректную дату и время срока.",
      invalid_title: "Название должно быть от 1 до 120 символов.",
      invalid_window: "Введите корректное окно выполнения: начало не позже конца, срок в будущем.",
      not_found_or_not_editable: "Задача уже закрыта или недоступна для изменения."
    },
    fallbacks: {
      actionFailed: "Не удалось выполнить действие с задачей.",
      addUserFailed: "Не удалось добавить пользователя.",
      badResponse: "Некорректный ответ API.",
      cleanupPreviewFailed: "Не удалось подготовить preview очистки.",
      configFailed: "Не удалось получить настройки приложения.",
      createAnnualEventFailed: "Не удалось создать ежегодное событие.",
      createTaskFailed: "Не удалось создать задачу.",
      deactivateUserFailed: "Не удалось отключить пользователя.",
      deleteAnnualEventFailed: "Не удалось удалить ежегодное событие.",
      deletePreviewFailed: "Не удалось подготовить удаление задачи.",
      deleteTaskFailed: "Не удалось удалить задачу.",
      exportFailed: "Не удалось подготовить export.",
      getAssigneesFailed: "Не удалось получить список исполнителей.",
      getAuditFailed: "Не удалось получить последние действия.",
      getCurrentUserFailed: "Не удалось получить текущего пользователя.",
      getAnnualEventsFailed: "Не удалось получить ежегодные события.",
      getHistoryFailed: "Не удалось получить историю задач.",
      getTasksFailed: "Не удалось получить список задач.",
      getUsersFailed: "Не удалось получить список пользователей.",
      monthlyUpdateFailed: "Не удалось обновить ежемесячную задачу.",
      runCleanupFailed: "Не удалось выполнить очистку.",
      updateTimezoneFailed: "Не удалось обновить часовой пояс.",
      updateTaskFailed: "Не удалось обновить задачу.",
      weeklyUpdateFailed: "Не удалось обновить еженедельную задачу."
    }
  },
  dates: {
    intlLocale: "ru-UA"
  },
  history: {
    allStatuses: "Все статусы",
    cancelled: "Отмененные",
    description: "Закрытые задачи с постраничной загрузкой.",
    done: "Выполненные",
    doneLate: "С опозданием",
    empty: "В истории пока нет закрытых задач.",
    familyScope: "Все семейные",
    filteredEmpty: "Нет задач с выбранным статусом.",
    loading: "Загрузка истории...",
    loadFailed: "Не удалось загрузить историю.",
    missed: "Пропущенные",
    myScope: "Только мои",
    records: (start, end, total) => total === 0 ? "0 записей" : `${start}-${end} из ${total}`,
    statusFilterLabel: "Фильтр статуса истории",
    title: "История и архив",
    toolbarLabel: "Область истории"
  },
  maintenance: {
    cleanupButton: "Подтвердить очистку",
    cleanupDone: (notificationLogDeleted, telegramMessageRefsDeleted) =>
      `Очистка выполнена. notification_log: ${notificationLogDeleted}, telegram_message_refs: ${telegramMessageRefsDeleted}.`,
    cleanupError: "Не удалось выполнить очистку.",
    cleanupPreviewError: "Не удалось подготовить preview очистки.",
    cleanupTitle: "Техническая очистка",
    description: "Административные операции без изменения задач.",
    downloadButton: "Скачать JSON",
    downloadDone: "Export JSON скачан.",
    downloadError: "Не удалось скачать export.",
    downloading: "Готовлю...",
    exportDescription: "Снимок пользователей, правил, задач, истории уведомлений и audit log для backup или будущей миграции.",
    exportTitle: "Portable JSON export",
    olderThanDays: (days, count) => `Старше ${days} дней: ${count}`,
    previewButton: "Проверить",
    previewIntro: "Удаляет только старые технические записи: notification_log старше 90 дней и telegram_message_refs старше 30 дней.",
    previewUntil: (value) => `До ${value}`,
    safeCleanupNote: "Задачи, пользователи, правила, история выполнения и audit log не затрагиваются.",
    title: "Обслуживание"
  },
  navigation: {
    appSections: "Разделы приложения",
    events: "События",
    history: "История",
    settings: "Настройки",
    tasks: "Задачи"
  },
  annualEvents: {
    created: "Событие создано.",
    createTitle: "Новое событие",
    dateLabel: "Дата события",
    day: "День",
    deleted: "Событие удалено.",
    deleteConfirm: "Удалить это ежегодное событие?",
    description: "Дни рождения, годовщины и другие даты. Они появляются в списке «Мои задачи» только за 7 дней до события.",
    empty: "Ежегодных событий пока нет.",
    emptyFamily: "Семейных событий пока нет.",
    emptyMy: "У вас пока нет назначенных событий.",
    eventYear: "Год события",
    eventYearHint: "Необязательно",
    eventYearWithCount: (year, count) => `${year} (${count} ${formatRuYearCount(count)})`,
    loadFailed: "Не удалось загрузить ежегодные события.",
    listLabel: "Списки ежегодных событий",
    loading: "Загрузка событий...",
    familyTab: "Все события",
    myTab: "Мои события",
    month: "Месяц",
    nextNotification: "Следующее уведомление",
    noNextNotification: "Не рассчитано",
    recipients: "Получатели",
    recipientsRequired: "Выберите хотя бы одного получателя.",
    records: (start, end, total) => total === 0 ? "0 событий" : `${start}-${end} из ${total}`,
    reminderTime: "Время уведомления",
    title: "Ежегодные события",
    titleField: "Название",
    titleRequired: "Введите название события.",
  },
  scheduleTypes: {
    monthly: "Ежемесячная",
    oneTime: "Разовая",
    oneTimeWindow: "Разовая с окном",
    weekly: "Еженедельная"
  },
  statuses: {
    active: "Активна",
    cancelled: "Отменена",
    done: "Выполнена",
    doneLate: "Выполнена с опозданием",
    missed: "Пропущена",
    overdue: "Просрочена"
  },
  taskCloseConfirm: {
    cancelled: "Действие отменено.",
    completeLateTitle: "Отметить выполненной с опозданием?",
    completeTitle: "Отметить задачу выполненной?",
    confirmComplete: "Да, выполнить",
    confirmMissed: "Да, пропустить",
    missedTitle: "Отметить задачу пропущенной?",
    recurringCompleteDescription: "Текущий экземпляр будет закрыт и перемещен в историю. Повторение останется включенным.",
    recurringMissedDescription: "Текущий экземпляр будет закрыт как пропущенный и перемещен в историю. Повторение останется включенным.",
    singleCompleteDescription: "Задача будет закрыта и перемещена в историю.",
    singleMissedDescription: "Задача будет закрыта как пропущенная и перемещена в историю."
  },
  settings: {
    maintenance: "Обслуживание",
    tabsLabel: "Разделы настроек",
    title: "Настройки",
    users: "Пользователи"
  },
  tasks: {
    alreadyChanged: "Задача уже изменена. Списки обновлены.",
    created: "Задача создана.",
    deleted: "Задача удалена.",
    description: "Активные и просроченные задачи семьи.",
    emptyFamily: "Активных семейных задач нет.",
    emptyMy: "Активных задач нет.",
    familyTab: "Все семейные",
    listLabel: "Списки задач",
    loadFailed: "Не удалось загрузить задачи.",
    myTab: "Мои задачи",
    refreshed: "Списки обновлены.",
    title: "Задачи",
    updated: "Задача обновлена."
  },
  telegram: {
    adminUsers: {
      accessDenied: "Доступ к этому боту ограничен. Обратитесь к администратору семейного бота.",
      addButton: "Добавить пользователя",
      addCancelled: "Добавление пользователя отменено.",
      addPrompt: "Введите Telegram ID нового пользователя числом.",
      addPromptWithExample: "Введите Telegram ID пользователя числом. Например: 123456789",
      added: (name, telegramUserId) => `Пользователь добавлен: ${name}\nID: ${telegramUserId}\n\nПопросите его открыть бота и нажать /start.`,
      adminOnly: "Раздел доступен только администратору.",
      deactivate: (name) => `Отключить ${name}`,
      deactivated: (name, telegramUserId) => `Пользователь отключен: ${name}\nID: ${telegramUserId}`,
      deactivateAdminOnly: "Отключать пользователей может только администратор.",
      empty: "Пользователи пока не добавлены.",
      invalidUser: "Некорректный пользователь.",
      notFoundOrCannotDeactivate: "Пользователь не найден или его нельзя отключить.",
      statusActive: "активен",
      statusDisabled: "отключен",
      statusLabel: "Статус",
      title: (count) => `Пользователи: ${count}`,
      userAdminRole: ", админ"
    },
    assigneeModes: {
      all: "Всем",
      selected: "Выбрать участников",
      self: "Только мне"
    },
    aiTaskDraft: {
      assigneeAll: "всем",
      assigneeSelf: "мне",
      buttons: {
        cancel: "Отмена",
        create: "Создать"
      },
      cancelled: "AI-черновик отменен.",
      createFailed: "AI-черновик не удалось создать как задачу. Отправьте текст задачи еще раз.",
      dateIssues: {
        date_in_past: "Указанная дата уже прошла. Введите будущую дату.",
        invalid_date: "AI распознал некорректную дату. Введите дату заново.",
        invalid_end_date: "AI распознал некорректную дату окончания окна. Введите дату окончания заново.",
        invalid_start_date: "AI распознал некорректную дату начала окна. Введите дату начала заново.",
        window_end_in_past: "Дата окончания окна уже прошла. Введите будущую дату окончания.",
        window_start_after_end: "Начало окна не может быть позже окончания. Введите новую дату окончания."
      },
      fields: {
        assignees: "Исполнители",
        date: "Дата",
        missing: "Не хватает",
        reminderTime: "Время напоминания",
        taskType: "Тип",
        title: "Название",
        window: "Окно"
      },
      invalidAssignee: "Исполнители не распознаны. Ответьте «мне» или «всем» либо выберите участников кнопками.",
      missingFields: {
        assignee_mode: "исполнители",
        date: "дата",
        end_date: "дата окончания окна",
        reminder_time: "время напоминания",
        start_date: "дата начала окна",
        title: "название"
      },
      notTask: "Я могу помочь создать напоминание. Например: 10 июля проверить кран.",
      selectAssignees: "Проверьте и выберите исполнителей кнопками.",
      prompts: {
        assignee: "Кому назначить задачу? Ответьте «мне» или «всем» либо выберите участников кнопками.",
        date: "Введите дату выполнения в формате dd-mm-yyyy. Например: 10-07-2026",
        windowEndDate: "Введите дату окончания окна в формате dd-mm-yyyy. Например: 12-07-2026",
        windowStartDate: "Введите дату начала окна в формате dd-mm-yyyy. Например: 10-07-2026",
        reminderTime: "Введите время напоминания в формате HH:mm. Например: 09:00",
        title: "Введите короткое название задачи."
      },
      title: "AI разобрал сообщение как черновик задачи:",
      taskTypeOneTime: "разовая",
      taskTypeOneTimeWindow: "разовая с окном",
      expired: "AI-черновик устарел. Отправьте текст задачи еще раз."
    },
    buttons: {
      cancel: "Отмена",
      confirmRecreate: "Да, пересоздать",
      confirmDelete: "Да, удалить",
      currentAndFuture: "Текущая и будущие",
      deleteTask: "Удалить задачу",
      done: "Выполнено",
      doneSelection: "Готово",
      edit: "Изменить",
      futureOnly: "Только будущие",
      keepTask: "Оставить задачу",
      missed: "Пропущена",
      snoozeOneHour: "Напомнить через час"
    },
    createPrompts: {
      cancelled: "Создание задачи отменено.",
      chooseAssignees: "Кому назначить задачу?",
      chooseMonthlyMode: "Как задать ежемесячное окно выполнения?",
      chooseTaskType: "Как часто должна повторяться задача?",
      chooseWeekday: "В какой день недели выполнять задачу?",
      createdMonthly: (title, assignees, window, reminder) => `Ежемесячная задача создана: ${title}\nИсполнители: ${assignees}\nОкно: ${window}\nНапоминание: ${reminder}`,
      createdOneTime: (title, assignees, due, reminder) => `Задача создана: ${title}\nИсполнители: ${assignees}\nСрок: ${due}, 23:59\nНапоминание: ${reminder}`,
      createdOneTimeWindow: (title, assignees, window, reminder) => `Разовая задача с окном создана: ${title}\nИсполнители: ${assignees}\nОкно: ${window}\nНапоминание: ${reminder}`,
      createdWeekly: (title, assignees, weekday, reminder, due) => `Еженедельная задача создана: ${title}\nИсполнители: ${assignees}\nДень: ${weekday}\nНапоминание: ${reminder}\nБлижайший срок: ${due}`,
      createAgain: "Нажмите «Создать задачу» ещё раз.",
      dailyReminderTime: "Введите время ежедневного напоминания в формате HH:mm. Например: 09:00",
      dueDate: "Введите дату выполнения в формате dd-mm-yyyy. Например: 25-06-2026",
      dueDateFuture: "Срок должен быть в будущем. Введите другую дату.",
      endPlusStartWindow: "Введите окно в формате 3+2. Это последние 3 дня месяца и первые 2 дня следующего. Для только последних дней используйте формат 3+0.",
      invalidMonthlyMode: "Неизвестный тип ежемесячного окна.",
      invalidOneTimeWindow: "Окно не распознано. Введите диапазон в формате dd-mm-yyyy - dd-mm-yyyy. Например: 25-06-2026 - 30-06-2026",
      invalidTaskType: "Неизвестный тип задачи.",
      invalidTitle: "Название должно быть от 1 до 120 символов. Введите короткое название задачи.",
      invalidDueDate: "Дата не распознана. Введите дату выполнения в формате dd-mm-yyyy. Например: 25-06-2026",
      invalidTime: "Время не распознано. Введите время напоминания в формате HH:mm. Например: 09:00",
      lastDaysWindow: "Введите количество последних дней месяца. Например: 1 или 3.",
      missingCreateData: "Данные создаваемой задачи не найдены. Нажмите «Создать задачу» ещё раз.",
      monthlyFixedWindow: "Введите день или диапазон дней месяца. Например: 5 или 1-5.",
      nextDueFailed: "Не удалось рассчитать ближайший срок. Попробуйте другое время.",
      oneTimeWindow: "Введите окно выполнения в формате dd-mm-yyyy - dd-mm-yyyy. Например: 25-06-2026 - 30-06-2026",
      oneTimeWindowEndFuture: "Конец окна должен быть в будущем. Введите другой диапазон дат.",
      reminderTime: "Введите время напоминания в формате HH:mm. Например: 09:00",
      reset: "Создание задачи сброшено. Нажмите «Создать задачу» ещё раз.",
      selectedAssigneesUnavailable: "Выбранные исполнители недоступны. Выберите исполнителей заново.",
      selectAssignees: "Выберите исполнителей. Нажатие на имя добавляет или убирает его.",
      selectAssigneesByButtons: "Выберите исполнителей кнопками.",
      selectAtLeastOneAssignee: "Выберите хотя бы одного исполнителя.",
      assigneeSummary: {
        all: (count) => `всем известным участникам (${count})`,
        selected: (count) => `выбранным участникам (${count})`,
        self: "только мне"
      },
      title: "Введите короткое название задачи. Например: Передать показания воды.",
      useMenuOrStart: "Пока используйте кнопки меню или команду /start."
    },
    editPrompts: {
      assigneesChanged: (assignees) => `Исполнители изменены: ${assignees}`,
      applyMonthlyAssignees: "Применить новых исполнителей только к будущим ежемесячным задачам или к текущей тоже?",
      applyWeeklyAssignees: "Применить новых исполнителей только к будущим еженедельным задачам или к текущей тоже?",
      cancelled: "Редактирование задачи отменено.",
      chooseField: "Выберите, что изменить.",
      chooseFieldFor: (title) => `Что изменить?\n\n${title}`,
      chooseNewWeekday: "Выберите новый день недели.",
      dueAtChanged: (due) => `Срок изменен: ${due}, 23:59`,
      dueAtOnlyOneTime: "Срок напрямую меняется только у разовых задач.",
      editDataMissing: "Данные редактирования не найдены. Нажмите «Изменить» ещё раз.",
      invalidDueDate: "Дата не распознана. Введите дату выполнения в формате dd-mm-yyyy. Например: 25-06-2026",
      invalidTaskType: "Некорректная задача.",
      invalidTime: "Время не распознано. Введите время напоминания в формате HH:mm. Например: 09:00",
      invalidTitle: "Название должно быть от 1 до 120 символов. Введите короткое новое название.",
      monthlyOnly: "Окно выполнения меняется только у ежемесячных задач.",
      monthlyScheduleReadFailed: "Не удалось прочитать текущее ежемесячное расписание.",
      monthlyWindowChanged: (window, time) => `Расписание изменено: ${window} ${time}`,
      newDueDate: "Введите новую дату выполнения в формате dd-mm-yyyy. Например: 25-06-2026",
      newReminderTime: "Введите новое время напоминания в формате HH:mm. Например: 09:00",
      newTitle: "Введите короткое новое название задачи.",
      notActual: "Это действие уже неактуально. Нажмите «Изменить» ещё раз.",
      oneTimeWindowWebOnly: "Окно разовой задачи пока меняется только через web-интерфейс.",
      recurringTimeOnly: "Время напоминания отдельно меняется только у повторяющихся задач.",
      reminderTimeChanged: (time) => `Время напоминания изменено: ${time}`,
      reminderTimeOnlyRegularOneTime: "Время напоминания напрямую меняется только у разовых задач.",
      scheduleConfirm: (lines) => `Изменение расписания пересоздаст текущую активную задачу.\n\n${lines.join("\n")}\n\nПродолжить?`,
      scheduleFallback: "ежемесячное окно",
      taskTypeNotEditable: "Пока можно редактировать только разовые, еженедельные и ежемесячные задачи.",
      titleChanged: (title) => `Название изменено: ${title}`,
      weekdayChanged: (weekday, time) => `Расписание изменено: ${weekday} ${time}`,
      weekdayOnlyWeekly: "День недели меняется только у еженедельных задач.",
      weeklyScheduleReadFailed: "Не удалось прочитать текущее еженедельное расписание.",
      windowSummary: {
        fixed: (startDay, endDay) => startDay === endDay ? `${startDay} число` : `${startDay}-${endDay} число`,
        endPlusStart: (lastDays, firstDays) => {
          if (firstDays === 0) {
            return lastDays === 1 ? "последний день месяца" : `последние ${lastDays} дн. месяца`;
          }

          return `последние ${lastDays} дн. + первые ${firstDays} дн.`;
        }
      }
    },
    deleteConfirm: {
      recurringDescription: "Будет отключено повторение, а текущая активная задача исчезнет из списков. История выполнения сохранится.",
      recurringTitle: "Удалить повторяющуюся задачу?",
      singleDescription: "Задача исчезнет из активных списков. История выполнения сохранится.",
      singleTitle: "Удалить задачу?"
    },
    fields: {
      assignees: "Исполнители",
      dueAt: "Срок",
      reminderTime: "Напоминание",
      status: "Статус",
      taskType: "Тип",
      title: "Название",
      weekday: "День",
      window: "Окно"
    },
    menu: {
      createTask: "Создать задачу",
      familyTasks: "Все семейные задачи",
      myTasks: "Мои задачи",
      users: "Пользователи"
    },
    messages: {
      emptyFamilyTasks: "<b>Активных семейных задач нет.</b>\n\nЗдесь будут задачи всех участников семьи.",
      emptyMyTasks: "<b>Активных задач нет.</b>\n\nЗдесь появятся задачи, назначенные вам.",
      menuTitle: "Меню",
      start: "Привет. Я семейный бот напоминаний."
    },
    notifications: {
      annualEvent: (title, eventDate, offsetDays) => {
        const when = offsetDays === 0 ? "сегодня" : `через ${offsetDays} ${formatRuDayCount(offsetDays)}`;

        return `Ежегодное событие: ${title}\nДата события: ${eventDate} (${when})`;
      },
      reminder: (title, dueAt) => `Напоминание: ${title}\nСрок: ${dueAt}`
    },
    notices: {
      cancelled: "Задача отменена.",
      deleteCancelled: "Удаление отменено.",
      deleted: "Задача удалена.",
      done: "Задача отмечена выполненной.",
      invalidTask: "Некорректная задача.",
      missed: "Задача отмечена пропущенной.",
      notFoundOrClosed: "Задача уже закрыта или недоступна.",
      notFoundOrClosedOrNotOverdue: "Задача уже закрыта, не просрочена или недоступна.",
      snoozedOneHour: "Напомню через час."
    },
    results: {
      cancelled: (title) => `Задача отменена: ${title}`,
      deleteCancelled: "Удаление задачи отменено.",
      deletedInstance: (title) => `Задача удалена.\n\n${title}\n\nОна убрана из активных списков.`,
      deletedRule: (title) => `Повторяющаяся задача удалена.\n\n${title}\n\nПовторение отключено, текущая задача убрана из активных списков.`,
      done: (title) => `Задача выполнена: ${title}`,
      missed: (title) => `Задача пропущена: ${title}`,
      snoozed: (title, time) => `Напомню ещё раз: ${title}\nВремя: ${time}`
    },
    monthlyModes: {
      endPlusStart: "Конец + начало месяца",
      fixed: "Дни месяца",
      lastDays: "Последние дни месяца"
    },
    taskTypes: {
      fallback: "задача",
      monthly: "Ежемесячная",
      oneTime: "Разовая",
      oneTimeWindow: "Разовая с окном",
      weekly: "Еженедельная"
    },
    taskList: {
      countLabel: (count) => {
        const lastTwoDigits = count % 100;
        const lastDigit = count % 10;

        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
          return "задач";
        }

        if (lastDigit === 1) {
          return "задача";
        }

        if (lastDigit >= 2 && lastDigit <= 4) {
          return "задачи";
        }

        return "задач";
      },
      overdue: "Просрочено",
      total: "Всего",
      updated: "Обновлено"
    },
    statuses: {
      active: "активна",
      overdue: "просрочена"
    },
    weekdaysShort: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  },
  users: {
    activate: "Включить",
    active: "Активен",
    addActivate: "Добавить / включить",
    addedOrActivated: "Пользователь добавлен или включен.",
    addFailed: "Не удалось добавить пользователя.",
    deactivate: "Отключить",
    deactivated: "Пользователь отключен.",
    deactivateFailed: "Не удалось отключить пользователя.",
    description: "Администрирование участников семьи.",
    disabled: "Отключен",
    empty: "Пользователей пока нет.",
    inputLabel: "Telegram ID нового пользователя",
    invalidTelegramId: "Введите Telegram ID числом.",
    loadFailed: "Не удалось загрузить пользователей.",
    loading: "Загрузка пользователей...",
    participant: "Участник",
    title: "Пользователи",
    userActivated: "Пользователь включен."
  },
  web: {
    actions: {
      cancel: "Отмена",
      chooseAll: "Выбрать всех",
      complete: "Выполнено",
      create: "Создать",
      creating: "Создаю...",
      delete: "Удалить",
      deleting: "Удаляю...",
      edit: "Изменить",
      keep: "Оставить",
      miss: "Пропущена",
      save: "Сохранить",
      saving: "Сохраняю...",
      unchooseAll: "Снять всех"
    },
    createModes: {
      deadline: "Разовая",
      monthlyFixed: "Ежемесячная: дни месяца",
      monthlyLastDays: "Ежемесячная: последние дни",
      weekly: "Еженедельная",
      window: "Разовая с окном"
    },
    delete: {
      confirm: "Да, удалить",
      recurringDescription: "Будет отключено повторение, а текущая активная задача исчезнет из списков. История выполнения сохранится.",
      recurringTitle: "Удалить повторяющуюся задачу",
      singleDescription: "Задача исчезнет из активных списков. История выполнения сохранится.",
      singleTitle: "Удалить задачу"
    },
    fields: {
      applyAssignees: "Исполнителей применить",
      assignees: "Исполнители",
      closedAt: "Закрыта",
      closedBy: "Кем закрыта",
      dueAt: "Срок",
      endDay: "Конец окна",
      firstDays: "Первые дни месяца",
      lastDays: "Последние дни месяца",
      reminderTime: "Время напоминания",
      startDay: "Начало окна",
      taskType: "Тип задачи",
      title: "Название",
      weekday: "День недели",
      window: "Окно",
      windowEnd: "Конец окна",
      windowStart: "Начало окна"
    },
    messages: {
      assignedToYou: "Назначена тебе",
      applyAssigneesCurrentAndFuture: "К текущей и будущим",
      applyAssigneesFutureOnly: "Только к будущим",
      checking: "Проверяю...",
      datesInTimezone: (timezone) => `Даты указываются в часовом поясе ${timezone}.`,
      loadingAssignees: "Загрузка исполнителей...",
      loadingTasks: "Загрузка задач..."
    },
    validation: {
      assigneesRequired: "Выберите хотя бы одного исполнителя.",
      createFailed: "Не удалось создать задачу.",
      dueDateRequired: "Введите дату выполнения и время напоминания.",
      invalidDueDate: "Введите корректную дату выполнения.",
      invalidWindowDates: "Введите корректные даты начала и конца окна.",
      loadingAssigneesFailed: "Не удалось загрузить исполнителей.",
      monthlyLastWindowRequired: "Введите количество последних дней, первых дней и время напоминания.",
      noChanges: "Нет изменений для сохранения.",
      reminderTimeRequired: "Введите время напоминания.",
      title: "Название должно быть от 1 до 120 символов.",
      updateFailed: "Не удалось обновить задачу.",
      windowRequired: "Введите начало окна, конец окна и время напоминания."
    }
  },
  weekdays: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
};

const EN_LABELS: AppLabels = {
  audit: {
    actions: {
      "task.cancelled": "Task cancelled",
      "task.completed": "Marked as done",
      "task.created": "Task created",
      "task.deleted": "Task deleted",
      "task.missed": "Marked as missed",
      "task.snoozed": "Reminder snoozed",
      "task.updated": "Task updated"
    },
    changedPrefix: "Changed",
    fields: {
      assignees: "assignees",
      due_at: "due date",
      reminder_time: "reminder",
      schedule: "schedule",
      title: "title",
      weekday: "weekday",
      window: "completion window"
    },
    resultPrefix: "Result",
    results: {
      cancelled: "cancelled",
      deleted_instance: "deleted",
      deleted_rule: "recurrence deleted",
      done: "done",
      done_late: "done late",
      missed: "missed",
      snoozed: "snoozed"
    },
    snoozedForMinutes: (minutes) => `Snoozed for ${minutes} min.`,
    unknownActor: "Unknown"
  },
  auditModal: {
    actor: "Actor",
    empty: "No actions yet.",
    loading: "Loading actions...",
    title: "Recent activity"
  },
  common: {
    back: "Back",
    loading: "Loading...",
    next: "Next",
    refresh: "Refresh",
    unknownError: "Unknown error."
  },
  account: {
    admin: "Admin",
    currentUser: "Current user",
    logout: "Log out",
    participant: "Member",
    timezone: "Timezone",
    timezoneDescription: "Used for date display and new task creation. Existing tasks are not recalculated.",
    timezoneHint: "IANA timezone, for example Europe/Kyiv or America/New_York.",
    timezoneSaved: "Timezone saved.",
    timezoneTitle: "Change timezone",
    useBrowserTimezone: "Use browser timezone",
    user: "User"
  },
  auth: {
    loginDescription: "Use the same Telegram account that has been added to the family bot.",
    loginTitle: "Sign in to Family Reminder"
  },
  api: {
    errors: {
      due_at_in_past: "Due date and reminder time must be in the future.",
      invalid_annual_event: "Check the event title, date, notification time, and recipients.",
      invalid_timezone: "Enter a valid IANA timezone, for example Europe/Kyiv.",
      invalid_assignees: "Choose at least one assignee.",
      invalid_available_from: "Enter a valid window start date.",
      invalid_due_at: "Enter a valid due date and reminder time.",
      invalid_title: "Title must be from 1 to 120 characters.",
      invalid_window: "Enter a valid completion window: start must not be after end, and due date must be in the future.",
      not_found_or_not_editable: "The task is already closed or unavailable for editing."
    },
    fallbacks: {
      actionFailed: "Failed to perform task action.",
      addUserFailed: "Failed to add user.",
      badResponse: "Invalid API response.",
      cleanupPreviewFailed: "Failed to prepare cleanup preview.",
      configFailed: "Failed to load application config.",
      createAnnualEventFailed: "Failed to create annual event.",
      createTaskFailed: "Failed to create task.",
      deactivateUserFailed: "Failed to disable user.",
      deleteAnnualEventFailed: "Failed to delete annual event.",
      deletePreviewFailed: "Failed to prepare task deletion.",
      deleteTaskFailed: "Failed to delete task.",
      exportFailed: "Failed to prepare export.",
      getAssigneesFailed: "Failed to load assignees.",
      getAuditFailed: "Failed to load recent activity.",
      getCurrentUserFailed: "Failed to load current user.",
      getAnnualEventsFailed: "Failed to load annual events.",
      getHistoryFailed: "Failed to load task history.",
      getTasksFailed: "Failed to load tasks.",
      getUsersFailed: "Failed to load users.",
      monthlyUpdateFailed: "Failed to update monthly task.",
      runCleanupFailed: "Failed to run cleanup.",
      updateTimezoneFailed: "Failed to update timezone.",
      updateTaskFailed: "Failed to update task.",
      weeklyUpdateFailed: "Failed to update weekly task."
    }
  },
  dates: {
    intlLocale: "en-GB"
  },
  history: {
    allStatuses: "All statuses",
    cancelled: "Cancelled",
    description: "Closed tasks with paginated loading.",
    done: "Done",
    doneLate: "Done late",
    empty: "There are no closed tasks yet.",
    familyScope: "All family",
    filteredEmpty: "No tasks with the selected status.",
    loading: "Loading history...",
    loadFailed: "Failed to load history.",
    missed: "Missed",
    myScope: "Only mine",
    records: (start, end, total) => total === 0 ? "0 records" : `${start}-${end} of ${total}`,
    statusFilterLabel: "History status filter",
    title: "History and archive",
    toolbarLabel: "History scope"
  },
  maintenance: {
    cleanupButton: "Confirm cleanup",
    cleanupDone: (notificationLogDeleted, telegramMessageRefsDeleted) =>
      `Cleanup finished. notification_log: ${notificationLogDeleted}, telegram_message_refs: ${telegramMessageRefsDeleted}.`,
    cleanupError: "Failed to run cleanup.",
    cleanupPreviewError: "Failed to prepare cleanup preview.",
    cleanupTitle: "Technical cleanup",
    description: "Administrative operations that do not change tasks.",
    downloadButton: "Download JSON",
    downloadDone: "Export JSON downloaded.",
    downloadError: "Failed to download export.",
    downloading: "Preparing...",
    exportDescription: "Snapshot of users, rules, tasks, notification history, and audit log for backup or future migration.",
    exportTitle: "Portable JSON export",
    olderThanDays: (days, count) => `Older than ${days} days: ${count}`,
    previewButton: "Preview",
    previewIntro: "Deletes only old technical records: notification_log older than 90 days and telegram_message_refs older than 30 days.",
    previewUntil: (value) => `Before ${value}`,
    safeCleanupNote: "Tasks, users, rules, completion history, and audit log are not affected.",
    title: "Maintenance"
  },
  navigation: {
    appSections: "Application sections",
    events: "Events",
    history: "History",
    settings: "Settings",
    tasks: "Tasks"
  },
  annualEvents: {
    created: "Event created.",
    createTitle: "New event",
    dateLabel: "Event date",
    day: "Day",
    deleted: "Event deleted.",
    deleteConfirm: "Delete this annual event?",
    description: "Birthdays, anniversaries, and other dates. They appear in the \"My tasks\" list only 7 days before the event.",
    empty: "There are no annual events yet.",
    emptyFamily: "There are no family events yet.",
    emptyMy: "You do not have any assigned events yet.",
    eventYear: "Event year",
    eventYearHint: "Optional",
    eventYearWithCount: (year, count) => `${year} (${count} ${count === 1 ? "year" : "years"})`,
    loadFailed: "Failed to load annual events.",
    listLabel: "Annual event lists",
    loading: "Loading events...",
    familyTab: "All events",
    myTab: "My events",
    month: "Month",
    nextNotification: "Next notification",
    noNextNotification: "Not scheduled",
    recipients: "Recipients",
    recipientsRequired: "Choose at least one recipient.",
    records: (start, end, total) => total === 0 ? "0 events" : `${start}-${end} of ${total}`,
    reminderTime: "Notification time",
    title: "Annual events",
    titleField: "Title",
    titleRequired: "Enter event title."
  },
  scheduleTypes: {
    monthly: "Monthly",
    oneTime: "One-time",
    oneTimeWindow: "One-time with window",
    weekly: "Weekly"
  },
  statuses: {
    active: "Active",
    cancelled: "Cancelled",
    done: "Done",
    doneLate: "Done late",
    missed: "Missed",
    overdue: "Overdue"
  },
  taskCloseConfirm: {
    cancelled: "Action cancelled.",
    completeLateTitle: "Mark this task as done late?",
    completeTitle: "Mark this task as done?",
    confirmComplete: "Yes, mark done",
    confirmMissed: "Yes, mark missed",
    missedTitle: "Mark this task as missed?",
    recurringCompleteDescription: "The current occurrence will be closed and moved to history. The recurrence will remain enabled.",
    recurringMissedDescription: "The current occurrence will be closed as missed and moved to history. The recurrence will remain enabled.",
    singleCompleteDescription: "The task will be closed and moved to history.",
    singleMissedDescription: "The task will be closed as missed and moved to history."
  },
  settings: {
    maintenance: "Maintenance",
    tabsLabel: "Settings sections",
    title: "Settings",
    users: "Users"
  },
  tasks: {
    alreadyChanged: "The task was already changed. Lists were refreshed.",
    created: "Task created.",
    deleted: "Task deleted.",
    description: "Active and overdue family tasks.",
    emptyFamily: "There are no active family tasks.",
    emptyMy: "There are no active tasks.",
    familyTab: "All family",
    listLabel: "Task lists",
    loadFailed: "Failed to load tasks.",
    myTab: "My tasks",
    refreshed: "Lists refreshed.",
    title: "Tasks",
    updated: "Task updated."
  },
  telegram: {
    adminUsers: {
      accessDenied: "Access to this bot is restricted. Contact the family bot administrator.",
      addButton: "Add user",
      addCancelled: "User addition cancelled.",
      addPrompt: "Enter the new user's numeric Telegram ID.",
      addPromptWithExample: "Enter the user's numeric Telegram ID. For example: 123456789",
      added: (name, telegramUserId) => `User added: ${name}\nID: ${telegramUserId}\n\nAsk them to open the bot and press /start.`,
      adminOnly: "This section is available only to administrators.",
      deactivate: (name) => `Disable ${name}`,
      deactivated: (name, telegramUserId) => `User disabled: ${name}\nID: ${telegramUserId}`,
      deactivateAdminOnly: "Only an administrator can disable users.",
      empty: "No users have been added yet.",
      invalidUser: "Invalid user.",
      notFoundOrCannotDeactivate: "User was not found or cannot be disabled.",
      statusActive: "active",
      statusDisabled: "disabled",
      statusLabel: "Status",
      title: (count) => `Users: ${count}`,
      userAdminRole: ", admin"
    },
    assigneeModes: {
      all: "Everyone",
      selected: "Choose members",
      self: "Only me"
    },
    aiTaskDraft: {
      assigneeAll: "everyone",
      assigneeSelf: "me",
      buttons: {
        cancel: "Cancel",
        create: "Create"
      },
      cancelled: "AI draft cancelled.",
      createFailed: "The AI draft could not be created as a task. Send the task text again.",
      dateIssues: {
        date_in_past: "The specified date has already passed. Enter a future date.",
        invalid_date: "AI recognized an invalid date. Enter the date again.",
        invalid_end_date: "AI recognized an invalid window end date. Enter the end date again.",
        invalid_start_date: "AI recognized an invalid window start date. Enter the start date again.",
        window_end_in_past: "The window end date has already passed. Enter a future end date.",
        window_start_after_end: "The window start cannot be later than its end. Enter a new end date."
      },
      fields: {
        assignees: "Assignees",
        date: "Date",
        missing: "Missing",
        reminderTime: "Reminder time",
        taskType: "Type",
        title: "Title",
        window: "Window"
      },
      invalidAssignee: "Assignees were not recognized. Reply with “me” or “everyone”, or choose members with the buttons.",
      missingFields: {
        assignee_mode: "assignees",
        date: "date",
        end_date: "window end date",
        reminder_time: "reminder time",
        start_date: "window start date",
        title: "title"
      },
      notTask: "I can help create a reminder. For example: check the faucet on July 10.",
      selectAssignees: "Review and select the assignees with the buttons.",
      prompts: {
        assignee: "Who should do this task? Reply with “me” or “everyone”, or choose members with the buttons.",
        date: "Enter the due date in dd-mm-yyyy format. For example: 10-07-2026",
        windowEndDate: "Enter the window end date in dd-mm-yyyy format. For example: 12-07-2026",
        windowStartDate: "Enter the window start date in dd-mm-yyyy format. For example: 10-07-2026",
        reminderTime: "Enter the reminder time in HH:mm format. For example: 09:00",
        title: "Enter a short task title."
      },
      title: "AI parsed your message as a task draft:",
      taskTypeOneTime: "one-time",
      taskTypeOneTimeWindow: "one-time with window",
      expired: "The AI draft has expired. Send the task text again."
    },
    buttons: {
      cancel: "Cancel",
      confirmRecreate: "Yes, recreate",
      confirmDelete: "Yes, delete",
      currentAndFuture: "Current and future",
      deleteTask: "Delete task",
      done: "Done",
      doneSelection: "Done",
      edit: "Edit",
      futureOnly: "Future only",
      keepTask: "Keep task",
      missed: "Missed",
      snoozeOneHour: "Remind in one hour"
    },
    createPrompts: {
      cancelled: "Task creation cancelled.",
      chooseAssignees: "Who should do this task?",
      chooseMonthlyMode: "How should the monthly completion window be set?",
      chooseTaskType: "How often should this task repeat?",
      chooseWeekday: "Which weekday should this task be done on?",
      createdMonthly: (title, assignees, window, reminder) => `Monthly task created: ${title}\nAssignees: ${assignees}\nWindow: ${window}\nReminder: ${reminder}`,
      createdOneTime: (title, assignees, due, reminder) => `Task created: ${title}\nAssignees: ${assignees}\nDue: ${due}, 23:59\nReminder: ${reminder}`,
      createdOneTimeWindow: (title, assignees, window, reminder) => `One-time task with window created: ${title}\nAssignees: ${assignees}\nWindow: ${window}\nReminder: ${reminder}`,
      createdWeekly: (title, assignees, weekday, reminder, due) => `Weekly task created: ${title}\nAssignees: ${assignees}\nDay: ${weekday}\nReminder: ${reminder}\nNext due: ${due}`,
      createAgain: "Press Create task again.",
      dailyReminderTime: "Enter the daily reminder time in HH:mm format. For example: 09:00",
      dueDate: "Enter the due date in dd-mm-yyyy format. For example: 25-06-2026",
      dueDateFuture: "The due date must be in the future. Enter another date.",
      endPlusStartWindow: "Enter the window as 3+2. This means the last 3 days of the month and the first 2 days of the next month. Use 3+0 for last days only.",
      invalidMonthlyMode: "Unknown monthly window type.",
      invalidOneTimeWindow: "Window was not recognized. Enter a range in dd-mm-yyyy - dd-mm-yyyy format. For example: 25-06-2026 - 30-06-2026",
      invalidTaskType: "Unknown task type.",
      invalidTitle: "Title must be from 1 to 120 characters. Enter a short task title.",
      invalidDueDate: "Date was not recognized. Enter the due date in dd-mm-yyyy format. For example: 25-06-2026",
      invalidTime: "Time was not recognized. Enter the reminder time in HH:mm format. For example: 09:00",
      lastDaysWindow: "Enter the number of last days of the month. For example: 1 or 3.",
      missingCreateData: "Task creation data was not found. Press Create task again.",
      monthlyFixedWindow: "Enter a month day or day range. For example: 5 or 1-5.",
      nextDueFailed: "Could not calculate the next due date. Try another time.",
      oneTimeWindow: "Enter the completion window in dd-mm-yyyy - dd-mm-yyyy format. For example: 25-06-2026 - 30-06-2026",
      oneTimeWindowEndFuture: "The window end must be in the future. Enter another date range.",
      reminderTime: "Enter the reminder time in HH:mm format. For example: 09:00",
      reset: "Task creation was reset. Press Create task again.",
      selectedAssigneesUnavailable: "Selected assignees are unavailable. Choose assignees again.",
      selectAssignees: "Choose assignees. Tap a name to add or remove it.",
      selectAssigneesByButtons: "Choose assignees with the buttons.",
      selectAtLeastOneAssignee: "Choose at least one assignee.",
      assigneeSummary: {
        all: (count) => `all known members (${count})`,
        selected: (count) => `selected members (${count})`,
        self: "only me"
      },
      title: "Enter a short task title. For example: Submit water meter readings.",
      useMenuOrStart: "Use the menu buttons or /start for now."
    },
    editPrompts: {
      assigneesChanged: (assignees) => `Assignees changed: ${assignees}`,
      applyMonthlyAssignees: "Apply the new assignees only to future monthly tasks, or to the current one too?",
      applyWeeklyAssignees: "Apply the new assignees only to future weekly tasks, or to the current one too?",
      cancelled: "Task editing cancelled.",
      chooseField: "Choose what to edit.",
      chooseFieldFor: (title) => `What do you want to edit?\n\n${title}`,
      chooseNewWeekday: "Choose a new weekday.",
      dueAtChanged: (due) => `Due date changed: ${due}, 23:59`,
      dueAtOnlyOneTime: "Due date can only be changed directly for one-time tasks.",
      editDataMissing: "Editing data was not found. Press Edit again.",
      invalidDueDate: "Date was not recognized. Enter the due date in dd-mm-yyyy format. For example: 25-06-2026",
      invalidTaskType: "Invalid task.",
      invalidTime: "Time was not recognized. Enter the reminder time in HH:mm format. For example: 09:00",
      invalidTitle: "Title must be from 1 to 120 characters. Enter a short new title.",
      monthlyOnly: "The completion window can only be changed for monthly tasks.",
      monthlyScheduleReadFailed: "Could not read the current monthly schedule.",
      monthlyWindowChanged: (window, time) => `Schedule changed: ${window} ${time}`,
      newDueDate: "Enter the new due date in dd-mm-yyyy format. For example: 25-06-2026",
      newReminderTime: "Enter the new reminder time in HH:mm format. For example: 09:00",
      newTitle: "Enter a short new task title.",
      notActual: "This action is no longer current. Press Edit again.",
      oneTimeWindowWebOnly: "The one-time task window can currently be changed only in the web interface.",
      recurringTimeOnly: "Reminder time can be changed separately only for recurring tasks.",
      reminderTimeChanged: (time) => `Reminder time changed: ${time}`,
      reminderTimeOnlyRegularOneTime: "Reminder time can only be changed directly for one-time tasks.",
      scheduleConfirm: (lines) => `Changing the schedule will recreate the current active task.\n\n${lines.join("\n")}\n\nContinue?`,
      scheduleFallback: "monthly window",
      taskTypeNotEditable: "For now, only one-time, weekly, and monthly tasks can be edited.",
      titleChanged: (title) => `Title changed: ${title}`,
      weekdayChanged: (weekday, time) => `Schedule changed: ${weekday} ${time}`,
      weekdayOnlyWeekly: "Weekday can only be changed for weekly tasks.",
      weeklyScheduleReadFailed: "Could not read the current weekly schedule.",
      windowSummary: {
        fixed: (startDay, endDay) => startDay === endDay ? `day ${startDay}` : `days ${startDay}-${endDay}`,
        endPlusStart: (lastDays, firstDays) => firstDays === 0 ? `last ${lastDays} day(s) of month` : `last ${lastDays} day(s) + first ${firstDays} day(s)`
      }
    },
    deleteConfirm: {
      recurringDescription: "The recurrence will be disabled and the current active task will disappear from active lists. Completion history will be kept.",
      recurringTitle: "Delete recurring task?",
      singleDescription: "The task will disappear from active lists. Completion history will be kept.",
      singleTitle: "Delete task?"
    },
    fields: {
      assignees: "Assignees",
      dueAt: "Due",
      reminderTime: "Reminder",
      status: "Status",
      taskType: "Type",
      title: "Title",
      weekday: "Day",
      window: "Window"
    },
    menu: {
      createTask: "Create task",
      familyTasks: "All family tasks",
      myTasks: "My tasks",
      users: "Users"
    },
    messages: {
      emptyFamilyTasks: "<b>There are no active family tasks.</b>\n\nTasks for all family members will appear here.",
      emptyMyTasks: "<b>There are no active tasks.</b>\n\nTasks assigned to you will appear here.",
      menuTitle: "Menu",
      start: "Hi. I am the family reminder bot."
    },
    notifications: {
      annualEvent: (title, eventDate, offsetDays) => {
        const when = offsetDays === 0 ? "today" : `in ${offsetDays} ${offsetDays === 1 ? "day" : "days"}`;

        return `Annual event: ${title}\nEvent date: ${eventDate} (${when})`;
      },
      reminder: (title, dueAt) => `Reminder: ${title}\nDue: ${dueAt}`
    },
    notices: {
      cancelled: "Task cancelled.",
      deleteCancelled: "Deletion cancelled.",
      deleted: "Task deleted.",
      done: "Task marked as done.",
      invalidTask: "Invalid task.",
      missed: "Task marked as missed.",
      notFoundOrClosed: "The task is already closed or unavailable.",
      notFoundOrClosedOrNotOverdue: "The task is already closed, not overdue, or unavailable.",
      snoozedOneHour: "I will remind you in one hour."
    },
    results: {
      cancelled: (title) => `Task cancelled: ${title}`,
      deleteCancelled: "Task deletion cancelled.",
      deletedInstance: (title) => `Task deleted.\n\n${title}\n\nIt was removed from active lists.`,
      deletedRule: (title) => `Recurring task deleted.\n\n${title}\n\nThe recurrence was disabled and the current task was removed from active lists.`,
      done: (title) => `Task done: ${title}`,
      missed: (title) => `Task missed: ${title}`,
      snoozed: (title, time) => `I will remind you again: ${title}\nTime: ${time}`
    },
    monthlyModes: {
      endPlusStart: "End + start of month",
      fixed: "Month days",
      lastDays: "Last days of month"
    },
    taskTypes: {
      fallback: "task",
      monthly: "Monthly",
      oneTime: "One-time",
      oneTimeWindow: "One-time with window",
      weekly: "Weekly"
    },
    taskList: {
      countLabel: (count) => count === 1 ? "task" : "tasks",
      overdue: "Overdue",
      total: "Total",
      updated: "Updated"
    },
    statuses: {
      active: "active",
      overdue: "overdue"
    },
    weekdaysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  },
  users: {
    activate: "Enable",
    active: "Active",
    addActivate: "Add / enable",
    addedOrActivated: "User added or enabled.",
    addFailed: "Failed to add user.",
    deactivate: "Disable",
    deactivated: "User disabled.",
    deactivateFailed: "Failed to disable user.",
    description: "Family member administration.",
    disabled: "Disabled",
    empty: "There are no users yet.",
    inputLabel: "New user's Telegram ID",
    invalidTelegramId: "Enter a numeric Telegram ID.",
    loadFailed: "Failed to load users.",
    loading: "Loading users...",
    participant: "Member",
    title: "Users",
    userActivated: "User enabled."
  },
  web: {
    actions: {
      cancel: "Cancel",
      chooseAll: "Select all",
      complete: "Done",
      create: "Create",
      creating: "Creating...",
      delete: "Delete",
      deleting: "Deleting...",
      edit: "Edit",
      keep: "Keep",
      miss: "Missed",
      save: "Save",
      saving: "Saving...",
      unchooseAll: "Clear all"
    },
    createModes: {
      deadline: "One-time",
      monthlyFixed: "Monthly: month days",
      monthlyLastDays: "Monthly: last days",
      weekly: "Weekly",
      window: "One-time with window"
    },
    delete: {
      confirm: "Yes, delete",
      recurringDescription: "The recurrence will be disabled and the current active task will disappear from active lists. Completion history will be kept.",
      recurringTitle: "Delete recurring task",
      singleDescription: "The task will disappear from active lists. Completion history will be kept.",
      singleTitle: "Delete task"
    },
    fields: {
      applyAssignees: "Apply assignees",
      assignees: "Assignees",
      closedAt: "Closed",
      closedBy: "Closed by",
      dueAt: "Due",
      endDay: "Window end",
      firstDays: "First days of next month",
      lastDays: "Last days of month",
      reminderTime: "Reminder time",
      startDay: "Window start",
      taskType: "Task type",
      title: "Title",
      weekday: "Weekday",
      window: "Window",
      windowEnd: "Window end",
      windowStart: "Window start"
    },
    messages: {
      assignedToYou: "Assigned to you",
      applyAssigneesCurrentAndFuture: "Current and future",
      applyAssigneesFutureOnly: "Future only",
      checking: "Checking...",
      datesInTimezone: (timezone) => `Dates use the ${timezone} timezone.`,
      loadingAssignees: "Loading assignees...",
      loadingTasks: "Loading tasks..."
    },
    validation: {
      assigneesRequired: "Choose at least one assignee.",
      createFailed: "Failed to create task.",
      dueDateRequired: "Enter a due date and reminder time.",
      invalidDueDate: "Enter a valid due date.",
      invalidWindowDates: "Enter valid window start and end dates.",
      loadingAssigneesFailed: "Failed to load assignees.",
      monthlyLastWindowRequired: "Enter last days, first days, and reminder time.",
      noChanges: "There are no changes to save.",
      reminderTimeRequired: "Enter reminder time.",
      title: "Title must be from 1 to 120 characters.",
      updateFailed: "Failed to update task.",
      windowRequired: "Enter window start, window end, and reminder time."
    }
  },
  weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
};

export function normalizeAppLocale(value: string | undefined): AppLocale {
  return value === "en" ? "en" : "ru";
}

export function getAppLabels(locale: AppLocale): AppLabels {
  return locale === "en" ? EN_LABELS : RU_LABELS;
}
