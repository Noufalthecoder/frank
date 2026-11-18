import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import { AppDialogProvider } from './components/AppDialogContext.jsx';
import Layout from './components/Layout.jsx';

import Landing from './pages/Landing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Catalog from './pages/Catalog.jsx';
import Racks from './pages/Racks.jsx';
import POSBilling from './pages/POSBilling.jsx';
import SalesHistory from './pages/SalesHistory.jsx';
import Procurement from './pages/Procurement.jsx';
import Finance from './pages/Finance.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <LanguageProvider>
      <AppDialogProvider>
        <HashRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/racks" element={<Navigate to="/settings?tab=racks" replace />} />
              <Route path="/pos" element={<POSBilling />} />
              <Route path="/history" element={<SalesHistory />} />
              <Route path="/vendors" element={<Procurement />} />
              <Route path="/procurement" element={<Navigate to="/vendors" replace />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/pos" replace />} />
            </Routes>
          </Layout>
        </HashRouter>
      </AppDialogProvider>
    </LanguageProvider>
  );
}
