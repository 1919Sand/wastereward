export type DayStatus = "completed" | "missed" | "pending" | "future";

export type FamilyData = {
  id: string;
  familyName: string;
  houseNo: string;
  society: string;
  points: number;
  currentStreak: number;
  bestStreak: number;
  rank: number;
  nextReward: {
    name: string;
    pointsRequired: number;
  };
  history: { date: string; reason: string; points: number }[];
  days: Record<string, DayStatus>;
};

function buildMonthDays(year: number, month: number, pattern: Array<[number, DayStatus]>) {
  const days: Record<string, DayStatus> = {};
  const totalDays = new Date(year, month, 0).getDate();

  for (let day = 1; day <= totalDays; day++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days[key] = "future";
  }

  for (const [day, status] of pattern) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (day <= totalDays) days[key] = status;
  }

  return days;
}

const familyOneDays: Record<string, DayStatus> = {
  ...buildMonthDays(2026, 9, [
    [1, "completed"],[2,"completed"],[3,"completed"],[4,"completed"],[5,"completed"],
    [6, "completed"],[7,"completed"],[8,"completed"],[9,"completed"],[10,"completed"],
    [11, "completed"],[12, "completed"],[13, "completed"],[14, "completed"],[15, "completed"],
    [16, "pending"],[17, "pending"]
  ]),
  ...buildMonthDays(2026, 8, [
    [1, "completed"],[2,"completed"],[3,"completed"],[4,"completed"],[5,"completed"],
    [6, "completed"],[7,"completed"],[8,"completed"],[9,"completed"],[10,"completed"],
    [11, "completed"],[12, "completed"],[13, "completed"],[14, "missed"],[15, "pending"],
    [16, "pending"],[17, "missed"],[18, "completed"],[19, "completed"],[20, "completed"],
    [21, "completed"],[22, "completed"],[23, "completed"],[24, "completed"],[25, "completed"],
    [26, "completed"],[27, "pending"],[28, "pending"],[29, "completed"],[30, "completed"],[31, "completed"]
  ])
};

const familyTwoDays: Record<string, DayStatus> = {
  ...buildMonthDays(2026, 9, [
    [1, "completed"],[2,"completed"],[3,"pending"],[4,"future"],[5,"future"],
    [6, "future"],[7,"future"],[8,"future"],[9,"future"],[10,"future"],
    [11, "future"],[12, "future"],[13, "future"],[14, "future"],[15, "future"],
    [16, "future"],[17, "future"],[18, "future"],[19, "future"],[20, "future"],
    [21, "future"],[22, "future"],[23, "future"],[24, "future"],[25, "future"],
    [26, "future"],[27, "future"],[28, "future"],[29, "future"],[30, "future"]
  ]),
  ...buildMonthDays(2026, 8, [
    [1, "completed"],[2,"completed"],[3,"completed"],[4,"completed"],[5,"completed"],
    [6, "completed"],[7,"missed"],[8,"missed"],[9,"pending"],[10,"pending"],
    [11, "completed"],[12, "completed"],[13, "completed"],[14, "completed"],[15, "completed"],
    [16, "completed"],[17, "completed"],[18, "completed"],[19, "missed"],[20, "completed"],
    [21, "completed"],[22, "completed"],[23, "completed"],[24, "completed"],[25, "completed"],
    [26, "pending"],[27, "pending"],[28, "completed"],[29, "completed"],[30, "completed"],[31, "completed"]
  ])
};

export const demoFamily: FamilyData = {
  id: "WR001",
  familyName: "Anju Bala",
  houseNo: "1171D-F1",
  society: "WasteReward Community",
  points: 120,
  currentStreak: 24,
  bestStreak: 24,
  rank: 1,
  nextReward: { name: "Mystery Reward", pointsRequired: 200 },
  history: [
    { date: "2026-09-15", reason: "Daily waste submission", points: 5 },
    { date: "2026-09-14", reason: "Daily waste submission", points: 5 },
    { date: "2026-09-13", reason: "Daily waste submission", points: 5 },
    { date: "2026-09-12", reason: "Daily waste submission", points: 5 },
    { date: "2026-09-11", reason: "Daily waste submission", points: 5 },
    { date: "2026-08-24", reason: "August cleanup drive", points: 5 },
    { date: "2026-08-20", reason: "August cleanup drive", points: 5 },
    { date: "2026-08-18", reason: "August cleanup drive", points: 5 }
  ],
  days: familyOneDays
};

export const demoFamilyTwo: FamilyData = {
  id: "WR002",
  familyName: "Kiran",
  houseNo: "1174D",
  society: "WasteReward Community",
  points: 90,
  currentStreak: 14,
  bestStreak: 16,
  rank: 2,
  nextReward: { name: "Mystery Reward", pointsRequired: 200 },
  history: [
    { date: "2026-09-03", reason: "Daily waste submission", points: 5 },
    { date: "2026-08-28", reason: "August cleanup drive", points: 5 },
    { date: "2026-08-21", reason: "Daily waste submission", points: 5 },
    { date: "2026-08-17", reason: "Daily waste submission", points: 5 }
  ],
  days: familyTwoDays
};

export const demoFamilies: FamilyData[] = [demoFamily, demoFamilyTwo];

export function makeEmptyFamily(familyId: string, familyName: string, houseNo: string): FamilyData {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const days: Record<string, DayStatus> = {};

  const totalDays = new Date(year, month, 0).getDate();
  for (let day = 1; day <= totalDays; day++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days[key] = day <= 3 ? "completed" : "future";
  }

  return {
    id: familyId,
    familyName,
    houseNo,
    society: "WasteReward Community",
    points: 0,
    currentStreak: 0,
    bestStreak: 0,
    rank: 1,
    nextReward: { name: "Mystery Reward", pointsRequired: 200 },
    history: [],
    days
  };
}