import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useI18n } from "../i18n/I18nProvider";

type Props = { fallback: (reset: () => void) => ReactNode; children: ReactNode };
type State = { failed: boolean };

/** Catches a render error so one broken page does not blank the whole site */
class Boundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page crashed", error, info.componentStack);
  }

  reset = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}

/** Resets on navigation, so leaving a broken page brings the site back */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  return (
    <Boundary
      key={pathname}
      fallback={(reset) => (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">{t.common.pageCrashed}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            {t.common.tryAgain}
          </button>
        </div>
      )}
    >
      {children}
    </Boundary>
  );
}
