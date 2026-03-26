sed -i 's/IssueStatus.WORK_DONE/IssueStatus.INSPECTING/g' src/seed/seed.ts
sed -i 's/status: '\''WORK_DONE'\''/status: '\''INSPECTING'\''/g' src/seed/seed.ts
sed -i 's/Issue \[WORK_DONE\]:/Issue \[INSPECTING_AGAIN\]:/g' src/seed/seed.ts
sed -i 's/Kavi Nagar – WORK_DONE/Kavi Nagar – INSPECTING (again)/g' src/seed/seed.ts
