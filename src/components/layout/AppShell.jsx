// --- IMPORTS ---
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';


// --- COMPONENTS ---
export const AppShell = ({
    currentUser = null,
    navigationItems = [],
    adminNavigationItems = [],
    activeNavigationKey = 'dashboard',
    onNavigationChange,
    onAccountClick,
    onSettingsClick,
    onSignOut,
    pageTitle,
    headerActions,
    detailPanel = null,
    children,
    ...props
}) => {
    // --- HOOKS & STATE ---
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // --- HANDLERS ---
    const handleOpenMobileSidebar = () => {
        setIsMobileSidebarOpen(true);
    };

    const handleCloseMobileSidebar = () => {
        setIsMobileSidebarOpen(false);
    };

    // --- RENDER ---
    return (
        <div
            className="flex h-screen w-screen overflow-hidden bg-background text-text"
            {...props}
        >
                    {/* Responsive Sidebar */}
                    <Sidebar
                        currentUser={currentUser}
                        navigationItems={navigationItems}
                        adminNavigationItems={adminNavigationItems}
                        activeNavigationKey={activeNavigationKey}
                        onNavigationChange={onNavigationChange}
                        onAccountClick={onAccountClick}
                        onSettingsClick={onSettingsClick}
                        onSignOut={onSignOut}
                        isMobileOpen={isMobileSidebarOpen}
                        onMobileClose={handleCloseMobileSidebar}
                    />

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                        {/* Top Bar / Header */}
                        <header className="h-14 px-4 sm:px-6 border-b border-surface-border bg-surface flex items-center justify-between gap-3 shrink-0 z-10">
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Mobile Sidebar Toggle Hamburger */}
                                <button
                                    type="button"
                                    aria-label="Open navigation menu"
                                    onClick={handleOpenMobileSidebar}
                                    className="sm:hidden p-1.5 -ml-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover cursor-pointer touch-manipulation"
                                >
                                    <Menu className="h-5 w-5" />
                                </button>

                                {pageTitle && (
                                    <h1 className="text-base sm:text-lg font-semibold text-text truncate">
                                        {pageTitle}
                                    </h1>
                                )}
                            </div>

                            {headerActions && (
                                <div className="flex items-center gap-2 shrink-0">
                                    {headerActions}
                                </div>
                            )}
                        </header>

                        {/* Page Content Viewport */}
                        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 bg-background">
                            {children}
                        </main>
                    </div>

                    {/* Optional Right Details / Inspector Panel */}
                    {detailPanel}
                </div>
    );
};
