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
import { AndroidInstallBanner } from './components/AndroidInstallBanner';
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
    connectBluetoothSerial,
    connectBluetoothBridge,
    getBridgeUrl,
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
      {/* Android Mobile PWA WebAPK Install Prompt Banner */}
      <AndroidInstallBanner />

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
        usbError={usbError}
        isPermissionsDisallowed={isPermissionsDisallowed}
        isUsbSupported={isUsbSupported}
        isSubmitting={isSubmitting}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-5 pb-24 md:pb-8">
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

      {/* Android HC-05 Connection Guide & Bridge Modal */}
      <AndroidBluetoothModal
        isOpen={showAndroidModal}
        onClose={() => setShowAndroidModal(false)}
        onConnectBluetooth={connectBluetooth}
        onConnectBluetoothSerial={connectBluetoothSerial}
        onConnectBluetoothBridge={connectBluetoothBridge}
        onConnectUsb={connectUsb}
        isIframeEmbedded={isIframeEmbedded}
        usbError={usbError}
        usbStatus={usbStatus}
        serialMode={serialMode}
        initialBridgeUrl={getBridgeUrl()}
      />
    </div>
  );
}
