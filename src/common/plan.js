export const PLAN_LIMITS = {
  free: {
    feedbackPerMonth: 100,
    projectsPerWorkspace: 3,
    websitesPerWorkspace: 3,
    membersPerWorkspace: 5,
    whiteLabel: false,
  },
  pro: {
    feedbackPerMonth: Infinity,
    projectsPerWorkspace: Infinity,
    websitesPerWorkspace: Infinity,
    membersPerWorkspace: Infinity,
    whiteLabel: true,
  },
};
