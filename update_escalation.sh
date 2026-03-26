sed -i 's/WORK_DONE/AFTER_PHOTO/g' src/services/escalation.service.ts
sed -i "s/status:      IssueStatus.AFTER_PHOTO/status:      IssueStatus.INSPECTING,\n      evidence:    { some: { type: 'CONTRACTOR' } }/g" src/services/escalation.service.ts
