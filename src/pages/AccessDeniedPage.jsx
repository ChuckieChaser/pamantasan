// --- IMPORTS ---
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';


// --- COMPONENTS ---
export const AccessDeniedPage = () => {
    const navigate = useNavigate();

    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-surface">
            <Card className="max-w-md w-full p-8 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 rounded-full bg-error/10 text-error flex items-center justify-center">
                    <ShieldAlert className="h-8 w-8" />
                </div>

                <div className="flex flex-col gap-1.5">
                    <h1 className="text-xl font-bold text-text">
                        Access Restricted
                    </h1>
                    <p className="text-sm text-text-muted leading-relaxed">
                        Your account credentials do not have the required administrative or departmental clearance to view this page.
                    </p>
                </div>

                <div className="pt-2 w-full">
                    <Button
                        variant="primary"
                        leadingIcon={ArrowLeft}
                        onClick={() => navigate('/dashboard')}
                        className="w-full"
                    >
                        Return to Dashboard
                    </Button>
                </div>
            </Card>
        </div>
    );
};
