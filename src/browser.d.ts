interface Window {
  google?: {
    accounts: {
      id: {
        initialize(options: {
          client_id: string;
          auto_select?: boolean;
          callback: (response: { credential: string }) => void;
        }): void;
        renderButton(container: HTMLElement, options: {
          type: string; theme: string; size: string; text: string; locale: string; width: number;
        }): void;
      };
    };
  };
}
