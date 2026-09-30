/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useHydroSense } from './hooks/useHydroSense';
import { Header, ActiveTab } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { SchoolProjectBanner } from './components/SchoolProjectBanner';
import { DashboardView } from './components/DashboardView';
import { ManualControlView } from './components/ManualControlView';
import { AutomationView } from './components/AutomationView';
import { SafetyView } from './components/SafetyView';
import { HardwareDocsView } from './components/HardwareDocsView';
import { AiAssistantView } from './components/AiAssistantView';
import { AndroidBluetoothModal } from './components/AndroidBluetoothModal';
import { Footer } from './components/Footer';
import { RefreshCw, Radio } from 'lucide-react';

export default function App() {
  const {
    state,
    isConnected,
    isControllerConnected,
    isCheckingConnection,
    connectionError,
    retryConnection,
    isSubmitting,
    isAiThinking,
    actionError,
    clearActionError,
    controlPump,
    setEmergencyStop,
    setMode,
    updateAutoConfig,
    executeAiVoiceCommand,
    refreshStatus,
    updateIntegrationConfig,
    // Web Serial USB & Bluetooth Additions
    usbStatus,
    serialMode,
    usbError,
    usbTelemetry,
    isUsbSupported,
    isIframeEmbedded,
    isPermissionsDisallowed,
    isAndroid,
    connectUsb,
    connectBluetooth,
    disconnectUsb,
    startUsbFilling,
    stopUsbPump,
    emergencyStopUsb,
    setUsbTarget,
  } = useHydroSense();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [showAndroidModal, setShowAndroidModal] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hydrosense_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Apply dark mode class to root document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('hydrosense_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('hydrosense_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors font-sans">
      {/* Top Header with School Pride Banner and USB Controller Status */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        connectionState={state.connectionState}
        isControllerConnected={isControllerConnected}
        onRetryConnection={retryConnection}
        isCheckingConnection={isCheckingConnection}
        emergencyStop={state.safety?.emergencyStop ?? false}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        onOpenSafety={() => setActiveTab('safety')}
        usbStatus={usbStatus}
        serialMode={serialMode}
        onConnectUsb={connectUsb}
        onConnectBluetooth={connectBluetooth}
        onDisconnectUsb={disconnectUsb}
        isUsbSupported={isUsbSupported}
        isPermissionsDisallowed={isPermissionsDisallowed}
        isAndroid={isAndroid}
        onOpenAndroidGuide={() => setShowAndroidModal(true)}
      />

      {/* School Project Info & Live Hardware Status Banner */}
      <SchoolProjectBanner
        connectionState={state.connectionState}
        isControllerConnected={isControllerConnected}
        onRetryConnection={retryConnection}
        isCheckingConnection={isCheckingConnection}
        onOpenHardware={() => setActiveTab('hardware')}
        onOpenSafety={() => setActiveTab('safety')}
        usbStatus={usbStatus}
        serialMode={serialMode}
        isAndroid={isAndroid}
        onOpenAndroidGuide={() => setShowAndroidModal(true)}
        onConnectUsb={connectUsb}
        onConnectBluetooth={connectBluetooth}
        onDisconnectUsb={disconnectUsb}
      />

      {/* Informative Hardware Standby & Offline Banner with USB & Bluetooth Connection Options */}
      {!isControllerConnected && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/50 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span className="font-bold text-slate-900 dark:text-white">Controller Offline:</span>
              <span>
                {usbError
                  ? usbError
                  : 'Arduino Uno (USB) અથવા HC-05 (Bluetooth) હાર્ડવેર હજી જોડાયેલ નથી. લાઈવ રીડિંગ્સ અને પંપ કંટ્રોલ માટે કનેક્ટ કરો.'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {(isPermissionsDisallowed || (usbError && (usbError.includes('iframe') || usbError.includes('સુરક્ષા પ્રતિબંધ') || usbError.includes('પોલિસી')))) && typeof window !== 'undefined' && (
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                  title="એપને નવી વિન્ડો/ટેબમાં ખોલો જેથી બ્રાઉઝર સીરીયલ પોર્ટની પરવાનગી આપે"
                >
                  <span>Open in Direct Tab ↗</span>
                </a>
              )}
              <button
                onClick={() => setShowAndroidModal(true)}
                className="px-3 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Android પર HC-05 કનેક્ટ કરવાની રીત"
              >
                <span>Android HC-05 મદદ</span>
              </button>
              <button
                onClick={connectUsb}
                disabled={!isUsbSupported || isSubmitting}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                title="Arduino Uno USB સાથે જોડાઓ (115200 Baud)"
              >
                <span>Connect USB</span>
              </button>
              <button
                onClick={connectBluetooth}
                disabled={!isUsbSupported || isSubmitting}
                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                title="HC-05 Bluetooth Virtual COM Port સાથે જોડાઓ (9600 Baud)"
              >
                <span>Connect Bluetooth</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            state={state}
            onRefresh={refreshStatus}
            onUpdateConfig={updateIntegrationConfig}
            onNavigateTab={(tab) => setActiveTab(tab)}
            isSubmitting={isSubmitting}
            usbStatus={usbStatus}
            serialMode={serialMode}
            usbError={usbError}
            usbTelemetry={usbTelemetry}
            isUsbSupported={isUsbSupported}
            isPermissionsDisallowed={isPermissionsDisallowed}
            isAndroid={isAndroid}
            onOpenAndroidGuide={() => setShowAndroidModal(true)}
            onConnectUsb={connectUsb}
            onConnectBluetooth={connectBluetooth}
            onDisconnectUsb={disconnectUsb}
            onStartFilling={startUsbFilling}
            onStopPump={stopUsbPump}
            onEmergencyStop={emergencyStopUsb}
            onSetUsbTarget={setUsbTarget}
          />
        )}

        {activeTab === 'manual' && (
          <ManualControlView
            state={state}
            onControlPump={controlPump}
            isSubmitting={isSubmitting}
            actionError={actionError}
            onClearError={clearActionError}
            usbStatus={usbStatus}
            serialMode={serialMode}
            usbError={usbError}
            usbTelemetry={usbTelemetry}
            isUsbSupported={isUsbSupported}
            isPermissionsDisallowed={isPermissionsDisallowed}
            isAndroid={isAndroid}
            onOpenAndroidGuide={() => setShowAndroidModal(true)}
            onConnectUsb={connectUsb}
            onConnectBluetooth={connectBluetooth}
            onDisconnectUsb={disconnectUsb}
            onStartFilling={startUsbFilling}
            onStopPump={stopUsbPump}
            onEmergencyStop={emergencyStopUsb}
            onSetUsbTarget={setUsbTarget}
          />
        )}

        {activeTab === 'automation' && (
          <AutomationView
            state={state}
            onUpdateAutoConfig={updateAutoConfig}
            onSetMode={setMode}
            isSubmitting={isSubmitting}
          />
        )}

        {activeTab === 'safety' && (
          <SafetyView
            state={state}
            onSetEmergencyStop={setEmergencyStop}
            isSubmitting={isSubmitting}
          />
        )}

        {activeTab === 'ai' && (
          <AiAssistantView
            state={state}
            onExecuteAiCommand={executeAiVoiceCommand}
            isThinking={isAiThinking}
          />
        )}

        {activeTab === 'hardware' && <HardwareDocsView />}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        emergencyStop={state.safety?.emergencyStop ?? false}
      />

      {/* Footer */}
      <Footer
        connectionState={state.connectionState}
        onSelectTab={(tab) => setActiveTab(tab)}
      />

      {/* Android HC-05 Connection Guide Modal */}
      <AndroidBluetoothModal
        isOpen={showAndroidModal}
        onClose={() => setShowAndroidModal(false)}
        onConnectBluetooth={connectBluetooth}
        onConnectUsb={connectUsb}
        isIframeEmbedded={isIframeEmbedded}
      />
    </div>
  );
}
