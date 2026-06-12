export const IDENTIFIER_WARNING =
  "Do not enter patient names, phone numbers, addresses, Aadhaar numbers, medical record numbers, raw clinical notes, screenshots, prescriptions, lab-report photos, or identifiable documents.";

export const respondentRoles = [
  "Physician",
  "Nurse",
  "Medical assistant",
  "Clinic coordinator",
  "Receptionist",
  "Lab staff",
  "Admin",
  "Other",
] as const;

export const specialties = [
  "General medicine",
  "Cardiology",
  "Endocrinology",
  "Oncology",
  "OB-GYN",
  "Pediatrics",
  "Surgery",
  "Orthopedics",
  "Neurology",
  "Multi-specialty",
  "Other",
] as const;

export const loopSpecialties = [
  "General medicine",
  "Cardiology",
  "Endocrinology",
  "Oncology",
  "OB-GYN",
  "Pediatrics",
  "Surgery",
  "Orthopedics",
  "Neurology",
  "Other",
] as const;

export const practiceSettings = [
  "Solo private clinic",
  "Group private clinic",
  "Private hospital OPD",
  "Government hospital OPD",
  "Charitable clinic",
  "Telemedicine",
  "Other",
] as const;

export const opdVolumes = ["<20", "20-39", "40-59", "60-79", ">=80", "Unknown"] as const;

export const supportStaffOptions = [
  "Receptionist",
  "Nurse",
  "MA",
  "Coordinator",
  "Lab coordinator",
  "Pharmacist",
  "None",
  "Other",
] as const;

export const trackingOptions = [
  "None",
  "Physician memory",
  "Staff memory",
  "Paper log",
  "Spreadsheet",
  "Clinic software",
  "EHR task",
  "WhatsApp",
  "Mixed",
  "Unknown",
] as const;

export const loopTrackingOptions = [
  "No formal tracking",
  "Physician memory",
  "Staff memory",
  "Paper log",
  "Spreadsheet",
  "Clinic software",
  "EHR task",
  "WhatsApp",
  "Mixed",
  "Unknown",
] as const;

export const communicationChannels = ["Phone", "WhatsApp", "SMS", "In-person", "Portal/app", "Email", "Other"] as const;

export const digitalMaturityOptions = [
  "1 mostly paper",
  "2 paper + phone",
  "3 spreadsheet or WhatsApp tracking",
  "4 clinic software",
  "5 integrated EHR or task system",
] as const;

export const loopCommunicationChannels = [
  "Phone",
  "WhatsApp",
  "SMS",
  "In-person",
  "Portal/app",
  "Other",
  "Unknown",
] as const;

export const recordUseBasisOptions = ["Mostly records", "Mixed records and memory", "Mostly memory"] as const;

export const loopFamilies = ["Abnormal diagnostic result", "Referral or follow-up"] as const;

export const loopTypes = [
  "Abnormal lab",
  "Abnormal imaging",
  "Abnormal pathology",
  "Specialist referral",
  "Imaging referral",
  "Procedure referral",
  "Follow-up appointment",
  "Repeat test",
  "Post-procedure follow-up",
  "Other",
] as const;

export const testCategories = [
  "CBC",
  "HbA1c",
  "renal function",
  "liver function",
  "thyroid",
  "lipid",
  "X-ray",
  "ultrasound",
  "CT/MRI",
  "mammogram",
  "pathology",
  "other",
  "N/A",
] as const;

export const referralCategories = [
  "Cardiology",
  "oncology",
  "endocrinology",
  "imaging",
  "surgery",
  "OB-GYN",
  "pediatrics",
  "post-procedure",
  "chronic follow-up",
  "other",
  "N/A",
] as const;

export const urgencyOptions = ["Routine", "Semi-urgent", "Urgent", "Critical", "Unclear"] as const;
export const severityOptions = ["Mild", "Moderate", "Severe", "Critical", "Not applicable", "Unclear"] as const;
export const recommendedWindows = ["Same day", "1-3 days", "4-7 days", "8-14 days", "15-30 days", ">30 days", "Unclear"] as const;
export const yesNoUnclear = ["Yes", "No", "Unclear"] as const;
export const yesNoUnknown = ["Yes", "No", "Unknown"] as const;
export const yesNoNotNeededUnknown = ["Yes", "No", "Not needed", "Unknown"] as const;

export const reviewStatuses = ["Reviewed", "Not reviewed", "Not needed", "Unknown"] as const;
export const contactStatuses = ["Contacted", "Not contacted", "Not needed", "Unknown"] as const;
export const actionStatuses = ["Action documented", "No action needed", "Action not documented", "Unknown"] as const;
export const followupScheduledStatuses = ["Scheduled", "Not scheduled", "Not needed", "Unknown"] as const;
export const closureStatuses = ["Closed", "Still open", "Lost to follow-up", "Escalated", "Closed as no action needed", "Unknown"] as const;
export const currentStatuses = ["Resolved", "Still open", "Lost to follow-up", "Escalated", "Closed as no action needed", "Unknown"] as const;

export const firstReceiverRoles = ["System alert", "Physician", "Nurse", "Receptionist", "Coordinator", "Lab staff", "Patient", "Unknown"] as const;
export const reviewerRoles = ["Physician", "Nurse", "Specialist", "Not reviewed", "Unknown"] as const;
export const contactRoles = ["Physician", "Nurse", "Receptionist", "Coordinator", "Patient not contacted", "Not needed", "Unknown"] as const;
export const ownerRoles = ["Physician", "Nurse", "Coordinator", "Receptionist", "Patient", "No clear owner", "Unknown", "Other"] as const;
export const closerRoles = ["Physician", "Nurse", "Coordinator", "Receptionist", "System", "Still open", "Unknown"] as const;
export const handoffCounts = ["0", "1", "2", "3", "4+", "Unknown"] as const;

export const evidenceSources = [
  "EHR",
  "Paper chart",
  "Lab log",
  "Referral register",
  "Appointment register",
  "Staff call log",
  "Physician memory",
  "Staff memory",
  "Other",
] as const;

export const confidenceOptions = ["Low", "Medium", "High"] as const;
export const selectionMethods = [
  "Most recent consecutive loops",
  "Randomly selected loops",
  "Convenience sample",
  "High-risk examples only",
  "Unknown",
] as const;

export const ownerExistsOptions = ["Yes", "No", "Sometimes", "Unknown"] as const;
export const unresolvedReviewCadenceOptions = ["Daily", "Weekly", "Occasionally", "No", "Unknown"] as const;
export const futureExportAvailableOptions = ["Appointments", "labs", "referrals", "follow-ups", "contact logs", "none", "unknown"] as const;
export const futureApprovalPathOptions = ["Doctor", "clinic owner", "hospital admin", "ethics committee", "IT department", "unknown"] as const;
