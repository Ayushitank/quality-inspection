import { Route, Routes } from 'react-router-dom';
import { BottomNav } from './components/BottomNav.jsx';
import { OfflineBanner } from './components/OfflineBanner.jsx';
import { useOfflineSync } from './offline/useOfflineSync.js';
import { InspectionsPage } from './pages/InspectionsPage.jsx';
import { NewInspectionPage } from './pages/NewInspectionPage.jsx';
import { SummaryPage } from './pages/SummaryPage.jsx';
import styles from './App.module.css';

export default function App() {
  const { syncNow } = useOfflineSync();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>Quality Inspections</h1>
      </header>
      <OfflineBanner onSyncNow={syncNow} />
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<InspectionsPage />} />
          <Route path="/new" element={<NewInspectionPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="*" element={<InspectionsPage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
