export const profileSuggestionKinds = ["current_topic", "interest_change", "work_learning_direction", "keyword"] as const;

export type ProfileSuggestionKind = typeof profileSuggestionKinds[number];

export type ProfileEvidence = {
  reportDate: string;
  targetName: string;
  title: string;
  url: string;
  content: string;
};

export type GeneratedProfileSuggestion = {
  kind: ProfileSuggestionKind;
  value: string;
  rationale: string;
};
