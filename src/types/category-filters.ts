export type CategoryFilterDefinition = {
  id: string;
  name: string;
  options: string[];
  required: boolean;
};

export type ProjectFilterValues = Record<string, string>;

