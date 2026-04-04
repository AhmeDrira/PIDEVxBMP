import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { PasswordInput } from '../ui/password-input';
import { Mail, Lock, Check, CheckCircle2, Loader2, ScanFace, KeyRound, AlertTriangle } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import Logo from '../common/Logo';
import authService from '../../services/authService';
import { toast } from 'sonner';
import { loginSchema, LoginFormValues } from '../../lib/validations';
import { GoogleLoginButton } from './GoogleLoginButton';
import FaceCaptureWidget from './FaceCaptureWidget';
import { useLanguage } from '../../context/LanguageContext';

type UserRole = 'artisan' | 'expert' | 'manufacturer' | 'admin';
type LoginMode = 'classic' | 'face';

interface LoginPageProps {
  onLogin: (role: UserRole, isPending?: boolean) => void;
  onRegister: () => void;
  onForgotPassword: (email?: string) => void;
}

export default function LoginPage({ onLogin, onRegister, onForgotPassword }: LoginPageProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const [loginMode, setLoginMode] = useState<LoginMode>('classic');
  const [isLoading, setIsLoading] = useState(false);
  const [faceError, setFaceError] = useState('');
  const [siteStats, setSiteStats] = useState({ activeUsers: 0, projects: 0, satisfaction: 0 });

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => {
        setSiteStats({
          activeUsers: Number(data?.activeUsers) || 0,
          projects: Number(data?.projects ?? data?.totalProjects ?? data?.activeProjects) || 0,
          satisfaction: Number(data?.satisfaction) || 0,
        });
      })
      .catch(() => {});
  }, []);

  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
    return String(n);
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const onSubmitForm = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const userData = await authService.login(data);
      if (userData && userData.role) {
        toast.success(tr('Login successful!', 'Connexion réussie !'));
        onLogin(userData.role as UserRole);
      } else {
        toast.error(tr('Invalid user data received', 'Données utilisateur invalides'));
      }
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        tr('Login failed. Please check your credentials.', 'Échec de la connexion. Vérifiez vos identifiants.');
      if (error.response?.status === 403 && error.response?.data?.notVerified) {
        toast.error(tr('Please verify your email before logging in.', 'Veuillez vérifier votre email avant de vous connecter.'));
      } else if (error.response?.status === 403 && error.response?.data?.isPendingManufacturer) {
        toast.info(tr('Your application is still being reviewed.', 'Votre candidature est en cours de révision.'));
        onLogin('manufacturer', true);
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onFaceCapture = async (descriptor: number[]) => {
    setIsLoading(true);
    setFaceError('');
    try {
      const userData = await authService.faceLogin(descriptor);
      if (userData && userData.role) {
        toast.success(tr('Face recognised — welcome back!', 'Visage reconnu — bienvenue !'));
        onLogin(userData.role as UserRole);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || tr('Face not recognised.', 'Visage non reconnu.');
      const isNoFace = error.response?.data?.noFace;
      if (isNoFace) {
        setFaceError(
          tr(
            'Facial recognition is unavailable. Please use standard login.',
            'La reconnaissance faciale est indisponible. Utilisez la connexion classique.',
          ),
        );
      } else {
        setFaceError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: <CheckCircle2 size={24} />, title: tr('Project Management', 'Gestion de projets'), description: tr('Track and manage all your construction projects in one place', 'Suivez et gérez tous vos projets de construction en un seul endroit') },
    { icon: <CheckCircle2 size={24} />, title: tr('Marketplace', 'Marché'), description: tr('Access quality materials from verified manufacturers', 'Accédez à des matériaux de qualité auprès de fabricants vérifiés') },
    { icon: <CheckCircle2 size={24} />, title: tr('Expert Network', 'Réseau d\'experts'), description: tr('Connect with construction experts and professionals', 'Connectez-vous avec des experts et des professionnels de la construction') },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white text-slate-900">
      {/* Left side — Branding */}
      <div className="lg:w-1/2 relative overflow-hidden bg-[#1e40af]">
        <div className="absolute inset-0">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1693679758394-6d56a1e5c1a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwbW9kZXJuJTIwYnVpbGRpbmd8ZW58MXx8fHwxNzcwNTc2NzAyfDA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Construction"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#1e40af]/95 via-[#1e3a8a]/90 to-[#1e40af]/95" />
        </div>
        <div className="relative z-10 h-full flex flex-col justify-center px-8 lg:px-16 py-16 text-white">
          <div className="max-w-lg">
            <Logo variant="light" size="lg" />
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-white leading-tight">
              {tr('Build Better, Faster, Together', 'Construisez mieux, plus vite, ensemble')}
            </h2>
            <p className="text-xl text-white/90 mb-12 leading-relaxed">
              {tr(
                'The complete platform for construction professionals to manage projects, connect with experts, and access quality materials.',
                'La plateforme complète pour les professionnels du bâtiment.',
              )}
            </p>
            <div className="space-y-6">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 shadow-lg">
                    {feature.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-white mb-1">{feature.title}</h4>
                    <p className="text-white/80 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-16 grid grid-cols-3 gap-8">
              <div>
                <p className="text-4xl font-bold text-white mb-1">{formatCount(siteStats.activeUsers)}</p>
                <p className="text-white/70">{tr('Active Users', 'Utilisateurs actifs')}</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-white mb-1">{formatCount(siteStats.projects)}</p>
                <p className="text-white/70">{tr('Projects', 'Projets')}</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-white mb-1">{siteStats.satisfaction}%</p>
                <p className="text-white/70">{tr('Satisfaction', 'Satisfaction')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side — Login form */}
      <div className="lg:w-1/2 flex items-start lg:items-center justify-center p-8 lg:p-12 bg-white overflow-y-auto min-h-screen lg:min-h-0">
        <div className="w-full max-w-xl py-6 lg:py-0">
          <Card className="p-8 bg-white rounded-3xl shadow-2xl border border-slate-200">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                {tr('Welcome Back', 'Bon retour')}
              </h2>
              <p className="text-slate-500 text-base">
                {tr('Sign in to continue to your account', 'Connectez-vous pour accéder à votre compte')}
              </p>
            </div>

            {/* Mode tabs */}
            <div className="flex rounded-2xl bg-slate-100 p-1 mb-6 gap-1">
              <button
                type="button"
                onClick={() => { setLoginMode('classic'); setFaceError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  loginMode === 'classic'
                    ? 'bg-white shadow text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <KeyRound size={16} />
                {tr('Classic Login', 'Connexion classique')}
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode('face'); setFaceError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  loginMode === 'face'
                    ? 'bg-white shadow text-[#1F3A8A]'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ScanFace size={16} />
                {tr('Face Login', 'Connexion faciale')}
              </button>
            </div>

            {/* ── Classic Login ── */}
            {loginMode === 'classic' && (
              <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-900 text-base">
                    {tr('Email Address', 'Adresse email')}
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      autoComplete="email"
                      {...register('email')}
                      className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.email ? 'border-red-500' : 'border-slate-300'} focus:border-[#1F3A8A] transition-colors bg-white text-slate-900 placeholder:text-slate-400`}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive font-medium">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-900 text-base">
                    {tr('Password', 'Mot de passe')}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={20} />
                    <PasswordInput
                      id="password"
                      placeholder={tr('Enter your password', 'Entrez votre mot de passe')}
                      autoComplete="current-password"
                      {...register('password')}
                      error={!!errors.password}
                      className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.password ? 'border-red-500' : 'border-slate-300'} focus:border-[#1F3A8A] transition-colors bg-white text-slate-900 placeholder:text-slate-400`}
                    />
                  </div>
                  {errors.password && <p className="text-sm text-destructive font-medium">{errors.password.message}</p>}
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center shrink-0">
                      <input
                        type="checkbox"
                        className="peer appearance-none w-6 h-6 rounded-lg border-2 border-slate-300 checked:border-[#1F3A8A] checked:bg-[#1F3A8A] transition-all duration-200 cursor-pointer"
                      />
                      <Check size={14} strokeWidth={3} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200 pointer-events-none" />
                    </div>
                    <span className="text-sm font-medium text-slate-500 group-hover:text-slate-900 transition-colors">
                      {tr('Remember me', 'Se souvenir de moi')}
                    </span>
                  </label>
                  <Button
                    variant="link"
                    className="p-0 h-auto font-normal text-[#1F3A8A] hover:text-[#172c6e]"
                    onClick={() => onForgotPassword(watch('email'))}
                    type="button"
                  >
                    {tr('Forgot password?', 'Mot de passe oublié ?')}
                  </Button>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 text-base font-semibold !bg-blue-700 hover:!bg-blue-800 !text-white rounded-xl shadow-lg shadow-blue-700/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                  style={{ backgroundColor: '#1F3A8A', color: '#FFFFFF' }}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" />{tr('Signing in…', 'Connexion…')}</>
                  ) : (
                    tr('Sign In', 'Se connecter')
                  )}
                </Button>

                <div className="relative py-2">
                  <div className="border-t border-slate-200" />
                  <div className="absolute inset-0 flex justify-center">
                    <span className="px-3 text-xs font-semibold text-slate-400 bg-white uppercase tracking-widest -mt-3">
                      {tr('or sign in with Google', 'ou avec Google')}
                    </span>
                  </div>
                </div>
                <GoogleLoginButton
                  variant="login"
                  onSuccess={(userData) => {
                    if (userData?.role) {
                      toast.success(tr('Login successful!', 'Connexion réussie !'));
                      onLogin(userData.role as UserRole);
                    }
                  }}
                />

                <div className="text-center pt-2">
                  <p className="text-slate-500">
                    {tr("Don't have an account?", "Pas encore de compte ?")}
                    {' '}
                    <button type="button" onClick={onRegister} className="font-semibold text-[#1F3A8A] hover:text-[#172c6e] transition-colors">
                      {tr('Create Account', 'Créer un compte')}
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* ── Face Login ── */}
            {loginMode === 'face' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 text-center">
                  {tr(
                    'Look directly into the camera. Your face will be recognised automatically.',
                    'Regardez directement dans la caméra. Votre visage sera reconnu automatiquement.',
                  )}
                </p>

                {isLoading ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <Loader2 size={40} className="animate-spin text-[#1F3A8A]" />
                    <p className="text-slate-600 font-medium">{tr('Verifying your face…', 'Vérification du visage…')}</p>
                  </div>
                ) : (
                  <FaceCaptureWidget
                    mode="login"
                    onCapture={onFaceCapture}
                    onCancel={() => setLoginMode('classic')}
                  />
                )}

                {/* Error / no-face message */}
                {faceError && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1">{tr('Facial recognition unavailable', 'Reconnaissance faciale indisponible')}</p>
                      <p>{faceError}</p>
                      <button
                        type="button"
                        onClick={() => setLoginMode('classic')}
                        className="mt-2 underline font-semibold"
                      >
                        {tr('Use standard login', 'Utiliser la connexion classique')}
                      </button>
                    </div>
                  </div>
                )}

                <div className="text-center pt-2">
                  <p className="text-slate-500">
                    {tr("Don't have an account?", "Pas encore de compte ?")}
                    {' '}
                    <button type="button" onClick={onRegister} className="font-semibold text-[#1F3A8A] hover:text-[#172c6e] transition-colors">
                      {tr('Create Account', 'Créer un compte')}
                    </button>
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
