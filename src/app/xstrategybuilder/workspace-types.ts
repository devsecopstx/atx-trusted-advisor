export type XsbWorkspaceAccount = {
  _id?: string;
  name: string;
  accountRef: string;
  brokerType: string;
  balance: number;
};

export type XsbWorkspacePortfolio = {
  _id: string;
  name: string;
  accounts: XsbWorkspaceAccount[];
  isDefault: boolean;
};

export type XsbInitialWorkspace =
  | { status: "ready"; portfolio: XsbWorkspacePortfolio }
  | { status: "error"; message: string };
