import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Clock, CheckCircle2, ArrowLeft } from 'lucide-react';
import RegisterLeftSection from './RegisterLeftSection';

interface ManufacturerWaitingPageProps {
  onBackToLogin: () => void;
}

export default function ManufacturerWaitingPage({ onBackToLogin }: ManufacturerWaitingPageProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left Section - Same as Register/Login */}
      <RegisterLeftSection />

      {/* Right Section - Waiting Message */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-background overflow-y-auto">
        <div className="w-full max-w-xl text-center">
          <Card className="p-10 bg-white rounded-3xl shadow-2xl border-0">
            <div className="mb-10 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mb-6">
                <Clock size={40} className="text-secondary animate-pulse" />
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-4">Application Pending</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                We are currently verifying your manufacturer status. You will have access to the website once your account has been reviewed and approved by our team.
              </p>
            </div>

            <div className="space-y-6 text-left mb-10">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 border-2 border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} className="text-accent" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">What happens next?</h4>
                  <p className="text-sm text-muted-foreground">Our team will review your business certification and details within 24-48 hours.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 border-2 border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} className="text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">Email Notification</h4>
                  <p className="text-sm text-muted-foreground">You will receive an email once your application has been approved or if we need more information.</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={onBackToLogin}
              className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={20} />
              Return to Login
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
