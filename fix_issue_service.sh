sed -i 's/IssueStatus.CONTRACTOR_ASSIGNED/IssueStatus.IN_PROGRESS/g' src/services/issue.service.ts
sed -i 's/CONTRACTOR_ASSIGNED/IN_PROGRESS/g' src/services/issue.service.ts
sed -i 's/IssueStatus.WORK_DONE/IssueStatus.INSPECTING/g' src/services/issue.service.ts
sed -i 's/WORK_DONE/INSPECTING/g' src/services/issue.service.ts
# Also, remove overlapping if any like: [IssueStatus.INSPECTING, IssueStatus.IN_PROGRESS, IssueStatus.INSPECTING] -> we can just let it be or replace one
sed -i 's/IssueStatus.INSPECTING, IssueStatus.IN_PROGRESS, IssueStatus.INSPECTING/IssueStatus.INSPECTING, IssueStatus.IN_PROGRESS/g' src/services/issue.service.ts

# What about rejectWorkDone? Add it if it's missing (it was added by user?)
