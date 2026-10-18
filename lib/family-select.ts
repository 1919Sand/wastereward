export const FAMILY_PROFILE_SELECT = `
  id, waste_reward_id, family_name, family_number, email, mobile_number,
  alternate_mobile_number, family_leader_name, family_leader_mobile,
  total_members, house_no, address_line_1, address_line_2, city, district,
  state_province, locality, country, pin_code, society, points,
  current_streak, best_streak, rank, next_reward, days, green_pause_days,
  referral_green_pause_days, created_at,
  point_transactions(date, reason, points)
`;
