export type DayStatus = "completed" | "missed" | "green_pause" | "pending" | "future" | "inactive";

export type FamilySummary = {
  id: string;
  familyNumber: string;
  familyName: string;
  locality: string;
};

export type FamilyData = {
  id: string;
  familyName: string;
  familyNumber: string;
  email: string;
  mobileNumber: string;
  alternateMobileNumber: string;
  familyLeaderName: string;
  familyLeaderMobile: string;
  totalMembers: number | null;
  houseNo: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  stateProvince: string;
  locality: string;
  country: string;
  pinCode: string;
  society: string;
  createdAt: string;
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
  greenPauseDays: number;
  referralGreenPauseDays: number;
  referrals: FamilySummary[];
  nearbyFamilies: FamilySummary[];
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
  ...buildMonthDays(2026, 10, [
    [1, "completed"],[2,"completed"],[3,"completed"],[4,"completed"],[5,"completed"],
    [6, "completed"],[7,"completed"],[8,"completed"],[9,"completed"],[10,"completed"],
    [11, "green_pause"],[12,"missed"],[13,"completed"]
  ]),
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
  ...buildMonthDays(2026, 10, [
    [1, "completed"],[2,"completed"],[3,"missed"],[4,"completed"],[5,"completed"],
    [6, "green_pause"],[7,"completed"],[8,"completed"],[9,"completed"],[10,"completed"],
    [11, "missed"],[12,"completed"],[13,"completed"]
  ]),
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
  familyNumber: "F1",
  email: "anju@example.com",
  mobileNumber: "+91 98765 43210",
  alternateMobileNumber: "",
  familyLeaderName: "Anju Bala",
  familyLeaderMobile: "+91 98765 43210",
  totalMembers: 4,
  houseNo: "1171D-F1",
  addressLine1: "House 1171D",
  addressLine2: "Green Avenue",
  city: "New Delhi",
  district: "South Delhi",
  stateProvince: "Delhi",
  locality: "Green Avenue",
  country: "India",
  pinCode: "110001",
  society: "WasteReward Community",
  createdAt: "2026-08-01T00:00:00.000Z",
  points: 120,
  currentStreak: 24,
  bestStreak: 24,
  rank: 1,
  nextReward: { name: "Mystery Reward", pointsRequired: 200 },
  history: [
    { date: "2026-10-13", reason: "Daily waste collection", points: 5 },
    { date: "2026-10-11", reason: "Green Pause used", points: 0 },
    { date: "2026-10-10", reason: "Daily waste collection", points: 5 },
    { date: "2026-10-09", reason: "Daily waste collection", points: 5 },
    { date: "2026-10-08", reason: "Daily waste collection", points: 5 },
    { date: "2026-10-07", reason: "Daily waste collection", points: 5 },
    { date: "2026-09-15", reason: "Daily waste submission", points: 5 },
    { date: "2026-09-14", reason: "Daily waste submission", points: 5 },
    { date: "2026-09-13", reason: "Daily waste submission", points: 5 },
    { date: "2026-09-12", reason: "Daily waste submission", points: 5 },
    { date: "2026-09-11", reason: "Daily waste submission", points: 5 },
    { date: "2026-08-24", reason: "August cleanup drive", points: 5 },
    { date: "2026-08-20", reason: "August cleanup drive", points: 5 },
    { date: "2026-08-18", reason: "August cleanup drive", points: 5 }
  ],
  days: familyOneDays,
  greenPauseDays: 4,
  referralGreenPauseDays: 1,
  referrals: [{ id: "WR002", familyNumber: "F2", familyName: "Kiran", locality: "Green Avenue" }],
  nearbyFamilies: [{ id: "WR002", familyNumber: "F2", familyName: "Kiran", locality: "Green Avenue" }]
};

export const demoFamilyTwo: FamilyData = {
  id: "WR002",
  familyName: "Kiran",
  familyNumber: "F2",
  email: "kiran@example.com",
  mobileNumber: "+91 98765 43211",
  alternateMobileNumber: "",
  familyLeaderName: "Kiran",
  familyLeaderMobile: "+91 98765 43211",
  totalMembers: 3,
  houseNo: "1174D",
  addressLine1: "House 1174D",
  addressLine2: "Green Avenue",
  city: "New Delhi",
  district: "South Delhi",
  stateProvince: "Delhi",
  locality: "Green Avenue",
  country: "India",
  pinCode: "110001",
  society: "WasteReward Community",
  createdAt: "2026-08-01T00:00:00.000Z",
  points: 90,
  currentStreak: 14,
  bestStreak: 16,
  rank: 2,
  nextReward: { name: "Mystery Reward", pointsRequired: 200 },
  history: [
    { date: "2026-10-13", reason: "Daily waste collection", points: 5 },
    { date: "2026-10-12", reason: "Daily waste collection", points: 5 },
    { date: "2026-10-11", reason: "Collection missed", points: 0 },
    { date: "2026-10-09", reason: "Daily waste collection", points: 5 },
    { date: "2026-09-03", reason: "Daily waste submission", points: 5 },
    { date: "2026-08-28", reason: "August cleanup drive", points: 5 },
    { date: "2026-08-21", reason: "Daily waste submission", points: 5 },
    { date: "2026-08-17", reason: "Daily waste submission", points: 5 }
  ],
  days: familyTwoDays,
  greenPauseDays: 4,
  referralGreenPauseDays: 0,
  referrals: [],
  nearbyFamilies: [{ id: "WR001", familyNumber: "F1", familyName: "Anju Bala", locality: "Green Avenue" }]
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
    familyNumber: "F1",
    email: "",
    mobileNumber: "",
    alternateMobileNumber: "",
    familyLeaderName: familyName,
    familyLeaderMobile: "",
    totalMembers: null,
    houseNo,
    addressLine1: houseNo,
    addressLine2: "",
    city: "",
    district: "",
    stateProvince: "",
    locality: "",
    country: "India",
    pinCode: "",
    society: "WasteReward Community",
    createdAt: new Date().toISOString(),
    points: 0,
    currentStreak: 0,
    bestStreak: 0,
    rank: 1,
    nextReward: { name: "Mystery Reward", pointsRequired: 200 },
    history: [],
    days,
    greenPauseDays: 4,
    referralGreenPauseDays: 0,
    referrals: [],
    nearbyFamilies: []
  };
}
