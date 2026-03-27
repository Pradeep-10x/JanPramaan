/**
 * JanPramaan — Bilingual translation dictionary (English / Hindi)
 * Every user-facing string is keyed by its error code or message ID.
 */

export type Lang = 'en' | 'hi';

type TranslationEntry = Record<Lang, string>;

// ── Error Messages ────────────────────────────────────────────────────────────
export const errors: Record<string, TranslationEntry> = {
  // Auth
  UNAUTHORIZED:        { en: 'Missing or invalid authorization header', hi: 'प्राधिकरण हेडर गायब या अमान्य है' },
  USER_NOT_EXISTS:     { en: 'User no longer exists', hi: 'उपयोगकर्ता अब मौजूद नहीं है' },
  INVALID_TOKEN:       { en: 'Invalid or expired token', hi: 'अमान्य या समय-सीमा समाप्त टोकन' },
  AUTH_REQUIRED:       { en: 'Authentication required', hi: 'प्रमाणीकरण आवश्यक है' },
  INVALID_CREDENTIALS: { en: 'Invalid email or password', hi: 'अमान्य ईमेल या पासवर्ड' },
  UNVERIFIED_EMAIL:    { en: 'Please verify your email address to log in', hi: 'कृपया लॉगिन करने के लिए अपना ईमेल सत्यापित करें' },
  DISPOSABLE_EMAIL:    { en: 'Registration with temporary or disposable email addresses is not allowed', hi: 'अस्थायी या डिस्पोज़ेबल ईमेल पते से पंजीकरण की अनुमति नहीं है' },
  EMAIL_EXISTS:        { en: 'A user with that email already exists', hi: 'इस ईमेल से पहले से एक उपयोगकर्ता मौजूद है' },

  // OTP
  INVALID_OTP:         { en: 'Invalid or expired OTP', hi: 'अमान्य या समय-सीमा समाप्त OTP' },

  // RBAC
  FORBIDDEN:           { en: 'You do not have permission to perform this action', hi: 'आपको यह कार्य करने की अनुमति नहीं है' },

  // Validation
  VALIDATION_ERROR:    { en: 'Validation failed', hi: 'सत्यापन विफल' },

  // General
  NOT_FOUND:           { en: 'Record not found', hi: 'रिकॉर्ड नहीं मिला' },
  CONFLICT:            { en: 'A record with that value already exists', hi: 'उस मान वाला रिकॉर्ड पहले से मौजूद है' },
  INTERNAL_ERROR:      { en: 'An unexpected error occurred', hi: 'एक अप्रत्याशित त्रुटि हुई' },

  // Ward / Unit
  INVALID_WARD:        { en: 'wardId must reference an existing WARD', hi: 'wardId को किसी मौजूदा वार्ड का संदर्भ देना चाहिए' },
  INVALID_UNIT:        { en: 'Admin unit not found', hi: 'प्रशासनिक इकाई नहीं मिली' },
  INVALID_PARENT:      { en: 'Parent admin unit not found', hi: 'मूल प्रशासनिक इकाई नहीं मिली' },
  NO_WARDS:            { en: 'No wards with location data found', hi: 'स्थान डेटा वाले कोई वार्ड नहीं मिले' },

  // Issue
  INVALID_STATUS:      { en: 'Invalid status transition', hi: 'अमान्य स्थिति परिवर्तन' },
  INVALID_PROJECT:     { en: 'Project not found', hi: 'परियोजना नहीं मिली' },
  INVALID_USER:        { en: 'User not found or invalid role', hi: 'उपयोगकर्ता नहीं मिला या अमान्य भूमिका' },
  INVALID_ROLE:        { en: 'Invalid role for this action', hi: 'इस कार्य के लिए अमान्य भूमिका' },
  WRONG_WARD:          { en: 'User does not belong to the same ward', hi: 'उपयोगकर्ता एक ही वार्ड से नहीं है' },
  SELF_DUPLICATE:      { en: 'An issue cannot be a duplicate of itself', hi: 'कोई समस्या स्वयं की डुप्लिकेट नहीं हो सकती' },
  DUPLICATE_CYCLE:     { en: 'Cannot mark as duplicate — this would create a circular chain', hi: 'डुप्लिकेट के रूप में चिह्नित नहीं किया जा सकता — यह एक चक्रीय श्रृंखला बनाएगा' },
  MISSING_REASON:      { en: 'A reason is required when rejecting an issue', hi: 'समस्या अस्वीकार करते समय कारण आवश्यक है' },
  MISSING_BEFORE_PHOTO:{ en: 'Inspector must upload a BEFORE photo before a contractor is hired', hi: 'ठेकेदार नियुक्त करने से पहले निरीक्षक को पहले की फोटो अपलोड करनी होगी' },
  INVALID_COORDS:      { en: 'Invalid coordinates provided', hi: 'अमान्य निर्देशांक दिए गए' },
  INVALID_ISSUE:       { en: 'Target issue not found', hi: 'लक्षित समस्या नहीं मिली' },

  // User management
  SELF_ACTION:         { en: 'You cannot perform this action on your own account', hi: 'आप अपने स्वयं के खाते पर यह कार्य नहीं कर सकते' },
  INVALID_TARGET:      { en: 'Admins cannot manage citizen accounts', hi: 'प्रशासक नागरिक खातों का प्रबंधन नहीं कर सकते' },
  WRONG_PASSWORD:      { en: 'Current password is incorrect', hi: 'वर्तमान पासवर्ड गलत है' },
  USER_NOT_FOUND:      { en: 'User not found', hi: 'उपयोगकर्ता नहीं मिला' },
};

// ── Success Messages ──────────────────────────────────────────────────────────
export const messages: Record<string, TranslationEntry> = {
  OTP_SENT:              { en: 'OTP sent to your email', hi: 'OTP आपके ईमेल पर भेजा गया' },
  OTP_VERIFY_PROMPT:     { en: 'OTP sent to email. Please verify to complete registration.', hi: 'OTP ईमेल पर भेजा गया। कृपया पंजीकरण पूरा करने के लिए सत्यापित करें।' },
  OTP_IF_REGISTERED:     { en: 'If this email is registered, an OTP has been sent.', hi: 'यदि यह ईमेल पंजीकृत है, तो एक OTP भेजा गया है।' },
  PASSWORD_RESET:        { en: 'Password reset successfully', hi: 'पासवर्ड सफलतापूर्वक रीसेट किया गया' },
  PASSWORD_CHANGED:      { en: 'Password changed successfully', hi: 'पासवर्ड सफलतापूर्वक बदला गया' },
  EVIDENCE_REJECTED:     { en: 'Evidence rejected (soft-deleted). Uploader notified and status updated if applicable.', hi: 'साक्ष्य अस्वीकृत (सॉफ्ट-डिलीट)। अपलोडर को सूचित किया गया।' },
  LANG_UPDATED:          { en: 'Language preference updated', hi: 'भाषा प्राथमिकता अपडेट की गई' },
};

// ── Notification Strings ──────────────────────────────────────────────────────
export const notifications: Record<string, TranslationEntry> = {
  // Titles
  NEW_ISSUE_TITLE:           { en: 'New Issue Reported', hi: 'नई समस्या दर्ज' },
  ISSUE_ACCEPTED_TITLE:      { en: 'Issue Accepted ✓', hi: 'समस्या स्वीकृत ✓' },
  ISSUE_REJECTED_TITLE:      { en: 'Issue Rejected', hi: 'समस्या अस्वीकृत' },
  INSPECTOR_ASSIGNED_TITLE:  { en: 'Inspector Assigned 🔍', hi: 'निरीक्षक नियुक्त 🔍' },
  INSPECTION_ASSIGNMENT:     { en: 'Inspection Assignment 🔍', hi: 'निरीक्षण कार्य 🔍' },
  CONTRACTOR_HIRED_TITLE:    { en: 'Contractor Hired', hi: 'ठेकेदार नियुक्त' },
  ISSUE_ASSIGNED_TITLE:      { en: 'Issue Assigned to You', hi: 'समस्या आपको सौंपी गई' },
  ISSUE_UPGRADED_TITLE:      { en: 'Issue Upgraded to Project 🏗️', hi: 'समस्या परियोजना में बदली 🏗️' },
  DUPLICATE_WARNING_TITLE:   { en: '⚠️ Possible Duplicate Issue', hi: '⚠️ संभावित डुप्लीकेट समस्या' },
  WORK_DONE_TITLE:           { en: 'Work Marked Complete', hi: 'कार्य पूर्ण चिह्नित' },
  ISSUE_VERIFIED_TITLE:      { en: 'Issue Verified ✅', hi: 'समस्या सत्यापित ✅' },
  ESCALATION_TITLE:          { en: '🚨 Issue Escalated', hi: '🚨 समस्या बढ़ाई गई' },

  // Bodies (use {0}, {1} etc. for interpolation)
  NEW_ISSUE_BODY:            { en: '"{0}" has been submitted in your ward ({1}).', hi: '"{0}" आपके वार्ड ({1}) में दर्ज की गई है।' },
  ISSUE_ACCEPTED_BODY:       { en: 'Your issue "{0}" has been accepted and is now being processed.', hi: 'आपकी समस्या "{0}" स्वीकृत हो गई है और अब प्रक्रिया में है।' },
  ISSUE_REJECTED_BODY:       { en: 'Your issue "{0}" was rejected. Reason: {1}', hi: 'आपकी समस्या "{0}" अस्वीकृत की गई। कारण: {1}' },
  INSPECTOR_ASSIGNED_BODY:   { en: 'An inspector has been assigned to your issue "{0}". Site inspection is underway.', hi: 'आपकी समस्या "{0}" के लिए एक निरीक्षक नियुक्त किया गया है। स्थल निरीक्षण जारी है।' },
  INSPECTION_ASSIGN_BODY:    { en: 'You have been assigned to inspect "{0}". Please upload a BEFORE photo.', hi: 'आपको "{0}" के निरीक्षण के लिए नियुक्त किया गया है। कृपया पहले की फोटो अपलोड करें।' },
  ISSUE_ASSIGNED_BODY:       { en: 'You have been assigned to handle issue "{0}".', hi: 'आपको समस्या "{0}" को संभालने के लिए सौंपा गया है।' },
  ISSUE_UPGRADED_BODY:       { en: 'Your issue "{0}" has been converted into a project: "{1}".', hi: 'आपकी समस्या "{0}" परियोजना में बदल दी गई है: "{1}"।' },
  DUPLICATE_WARNING_BODY:    { en: 'New issue "{0}" may be a duplicate of {1} existing issue(s) nearby (within {2}m).', hi: 'नई समस्या "{0}" {2}m के भीतर {1} मौजूदा समस्या(ओं) की डुप्लिकेट हो सकती है।' },
};

// ── Enum Labels ───────────────────────────────────────────────────────────────
export const enumLabels: Record<string, Record<string, TranslationEntry>> = {
  Role: {
    CITIZEN:    { en: 'Citizen',    hi: 'नागरिक' },
    OFFICER:    { en: 'Officer',    hi: 'अधिकारी' },
    INSPECTOR:  { en: 'Inspector',  hi: 'निरीक्षक' },
    ADMIN:      { en: 'Admin',      hi: 'प्रशासक' },
    CONTRACTOR: { en: 'Contractor', hi: 'ठेकेदार' },
  },
  IssueStatus: {
    OPEN:                { en: 'Open',                hi: 'खुला' },
    ACCEPTED:            { en: 'Accepted',            hi: 'स्वीकृत' },
    REJECTED:            { en: 'Rejected',            hi: 'अस्वीकृत' },
    ASSIGNED:            { en: 'Assigned',            hi: 'सौंपा गया' },
    INSPECTING:          { en: 'Inspecting',          hi: 'निरीक्षण जारी' },
    CONTRACTOR_ASSIGNED: { en: 'Contractor Assigned', hi: 'ठेकेदार नियुक्त' },
    INSPECTING_WORK:     { en: 'Inspecting Work',     hi: 'कार्य निरीक्षण' },
    UNDER_REVIEW:        { en: 'Under Review',        hi: 'समीक्षाधीन' },
    IN_PROGRESS:         { en: 'In Progress',         hi: 'प्रगति में' },
    COMPLETED:           { en: 'Completed',           hi: 'पूर्ण' },
    VERIFIED:            { en: 'Verified',            hi: 'सत्यापित' },
  },
  Department: {
    MUNICIPAL:   { en: 'Municipal',   hi: 'नगरपालिका' },
    ELECTRICITY: { en: 'Electricity', hi: 'बिजली' },
    WATER:       { en: 'Water',       hi: 'जल' },
    MEDICAL:     { en: 'Medical',     hi: 'चिकित्सा' },
    TRANSPORT:   { en: 'Transport',   hi: 'परिवहन' },
  },
  IssuePriority: {
    HIGH:   { en: 'High',   hi: 'उच्च' },
    MEDIUM: { en: 'Medium', hi: 'मध्यम' },
    LOW:    { en: 'Low',    hi: 'निम्न' },
  },
};

// ── Validation Templates ──────────────────────────────────────────────────────
export const validation: Record<string, TranslationEntry> = {
  FIELD_REQUIRED:    { en: '{0} is required', hi: '{0} आवश्यक है' },
  FIELD_MUST_NUMBER: { en: '{0} must be a number', hi: '{0} एक संख्या होनी चाहिए' },
  FIELD_MUST_STRING: { en: '{0} must be a string', hi: '{0} एक स्ट्रिंग होनी चाहिए' },
  FIELD_MUST_ENUM:   { en: '{0} must be one of: {1}', hi: '{0} इनमें से एक होना चाहिए: {1}' },
};
