import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { JobForm } from '@/components/jobs/JobForm';
import { useJobs } from '@/hooks/use-jobs';
import { useToast } from '@/hooks/use-toast';

export default function JobCreate() {
  const navigate = useNavigate();
  const { createJob, isLoading } = useJobs();
  const { toast } = useToast();

  const handleSubmit = async (
    title: string,
    description: string,
    flagFormat: string,
    files: File[],
    category?: string,
    challengeUrl?: string
  ) => {
    try {
      const job = await createJob(title, description, flagFormat, files, category, challengeUrl);
      toast({
        title: 'Analysis Created',
        description: `Job "${title}" has been queued for analysis.`,
      });
      navigate(`/jobs/${job.id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create analysis job.',
        variant: 'destructive',
      });
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">New Analysis</h1>
            <p className="text-muted-foreground mt-1">
              Upload challenge files to start automated analysis
            </p>
          </div>
        </div>

        <JobForm onSubmit={handleSubmit} isLoading={isLoading} />
      </div>
    </AppLayout>
  );
}
