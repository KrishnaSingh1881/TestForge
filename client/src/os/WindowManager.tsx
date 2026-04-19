import { useOSStore } from './store/useOSStore';
import AppWindow from './AppWindow';
import type { AppType } from './store/useOSStore';

import TestsApp from './apps/TestsApp';
import TestSessionApp from './apps/TestSessionApp';
import StudentResultsApp from './apps/StudentResultsApp';
import StudentAnalyticsApp from './apps/StudentAnalyticsApp';
import StudentIntegrityApp from './apps/StudentIntegrityApp';
import QuestionBankApp from './apps/QuestionBankApp';
import TestManagerApp from './apps/TestManagerApp';
import ResultsApp from './apps/ResultsApp';
import AdminIntegrityApp from './apps/AdminIntegrityApp';
import AdminAnalyticsApp from './apps/AdminAnalyticsApp';
import CodeEditorApp from './apps/CodeEditorApp';
import TestSettingsApp from './apps/TestSettingsApp';


const APP_COMPONENTS: Record<AppType, React.ComponentType<any>> = {
  'tests':             TestsApp,
  'test-session':      TestSessionApp,
  'results':           StudentResultsApp,
  'analytics':         StudentAnalyticsApp,
  'integrity':         StudentIntegrityApp,
  'question-bank':     QuestionBankApp,
  'test-manager':      TestManagerApp,
  'admin-results':     ResultsApp,
  'admin-integrity':   AdminIntegrityApp,
  'admin-analytics':   AdminAnalyticsApp,
  'code-editor':       CodeEditorApp,
  'test-settings':     TestSettingsApp,
};

export default function WindowManager() {
  const { windows } = useOSStore();

  return (
    <>
      {windows.map(win => {
        const AppComponent = APP_COMPONENTS[win.appType];
        if (!AppComponent) return null;

        return (
          <AppWindow key={win.id} window={win}>
            <AppComponent id={win.id} {...(win.appProps ?? {})} />
          </AppWindow>
        );
      })}
    </>
  );
}
