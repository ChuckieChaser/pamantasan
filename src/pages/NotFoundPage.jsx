// --- IMPORTS ---
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';


// --- COMPONENTS ---
export const NotFoundPage = () => {
    const navigate = useNavigate();

    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-surface">
            <Card className="max-w-md w-full p-8 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                    <FileQuestion className="h-8 w-8" />
                </div>

                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-mono font-semibold tracking-wider text-accent uppercase">
                        Error 404
                    </span>
                    <h1 className="text-xl font-bold text-text">
                        Page Not Found
                    </h1>
                    <p className="text-sm text-text-muted leading-relaxed">
                        The requested repository module, record, or route could not be located on this server.
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
