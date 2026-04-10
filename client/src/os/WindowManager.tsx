import { AnimatePresence } from 'framer-motion';
import { useOSStore } from './store/useOSStore';
import AppWindow from './AppWindow';
import type { AppType } from './store/useOSStore';

import TestsApp from './apps/TestsApp';
import TestSessionApp from './apps/TestSessionApp';
import ResultsApp from './apps/ResultsApp';
import AnalyticsApp from './apps/AnalyticsApp';
import QuestionBankApp from './apps/QuestionBankApp';
import TestManagerApp from './apps/TestManagerApp';
import IntegrityApp from './apps/IntegrityApp';
import AdminAnalyticsApp from './apps/AdminAnalyticsApp';

const APP_COMPONENTS: Record<AppType, React.ComponentType<any>> = {
  'tests':           TestsApp,
  'test-session':    TestSessionApp,
  'results':         ResultsApp,
  'analytics':       AnalyticsApp,
  'question-bank':   QuestionBankApp,
  'test-manager':    TestManagerApp,
  'integrity':       IntegrityApp,
  'admin-analytics': AdminAnalyticsApp,
};

export default function WindowManager() {
  const { windows } = useOSStore();

  return (
    <AnimatePresence>
      {windows.map(win => {
        const AppComponent = APP_COMPONENTS[win.appType];
        if (!AppComponent) return null;

        return (
          <AppWindow key={win.id} window={win}>
            <AppComponent {...(win.appProps ?? {})} />
          </AppWindow>
        );
      })}
    </AnimatePresence>
  );
}
