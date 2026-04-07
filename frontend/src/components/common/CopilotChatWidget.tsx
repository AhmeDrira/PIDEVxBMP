import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Bot, Loader2, MessageSquare, Send, Sparkles, X } from 'lucide-react';

type DashboardRole = 'artisan' | 'expert' | 'manufacturer';

type QuickAction = {
	id: string;
	label: string;
	prompt: string;
	navigateTo?: string;
};

type ChatMessage = {
	id: string;
	role: 'assistant' | 'user';
	text: string;
};

type UserContext = {
	userId: string;
	firstName: string;
	lastName: string;
	role: DashboardRole;
	profileCompletion: number;
	subscriptionStatus: string;
};

interface CopilotChatWidgetProps {
	role: DashboardRole;
	activeView: string;
	isVisible: boolean;
	onNavigate?: (view: string) => void;
}

const BLUE_DARK = '#1D4ED8';
const EDGE_GAP = 16;
const BUBBLE_SIZE = 56;
const CHAT_PANEL_MAX_WIDTH = 480;
const CHAT_PANEL_MAX_HEIGHT = 700;

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const safeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getToken = () => {
	const direct = localStorage.getItem('token');
	if (direct) return direct;

	try {
		const parsed = JSON.parse(localStorage.getItem('user') || '{}');
		return parsed?.token || null;
	} catch {
		return null;
	}
};

const getCompletionFields = (role: DashboardRole, user: Record<string, unknown>) => {
	if (role === 'expert') {
		return [
			{ weight: 10, ok: Boolean(safeText(user.firstName) && safeText(user.lastName)) },
			{ weight: 5, ok: Boolean(safeText(user.email)) },
			{ weight: 15, ok: Boolean(safeText(user.profilePhoto)) },
			{ weight: 10, ok: Boolean(safeText(user.phone)) },
			{ weight: 15, ok: Boolean(safeText(user.location)) },
			{ weight: 15, ok: Boolean(safeText(user.bio)) },
			{ weight: 15, ok: Boolean(safeText(user.domain) || safeText(user.specialization)) },
			{ weight: 15, ok: Boolean(safeText(user.institution)) },
		];
	}

	if (role === 'manufacturer') {
		return [
			{ weight: 10, ok: Boolean(safeText(user.firstName) && safeText(user.lastName)) },
			{ weight: 5, ok: Boolean(safeText(user.email)) },
			{ weight: 10, ok: Boolean(safeText(user.profilePhoto)) },
			{ weight: 15, ok: Boolean(safeText(user.companyName)) },
			{ weight: 10, ok: Boolean(safeText(user.phone)) },
			{ weight: 15, ok: Boolean(safeText(user.location)) },
			{ weight: 20, ok: Boolean(safeText(user.description)) },
			{ weight: 15, ok: Boolean(safeText(user.certificationNumber)) },
		];
	}

	return [
		{ weight: 10, ok: Boolean(safeText(user.firstName) && safeText(user.lastName)) },
		{ weight: 5, ok: Boolean(safeText(user.email)) },
		{ weight: 15, ok: Boolean(safeText(user.profilePhoto)) },
		{ weight: 10, ok: Boolean(safeText(user.phone)) },
		{ weight: 15, ok: Boolean(safeText(user.location)) },
		{ weight: 15, ok: Boolean(safeText(user.bio)) },
		{ weight: 15, ok: Boolean(safeText(user.domain) || safeText(user.specialization)) },
		{ weight: 10, ok: Number.isFinite(Number(user.yearsExperience)) && Number(user.yearsExperience) > 0 },
		{ weight: 5, ok: Array.isArray(user.skills) && user.skills.length > 0 },
	];
};

const computeProfileCompletion = (role: DashboardRole, user: Record<string, unknown>) =>
	getCompletionFields(role, user).reduce((score, field) => score + (field.ok ? field.weight : 0), 0);

const QUICK_ACTIONS_BY_ROLE: Record<DashboardRole, QuickAction[]> = {
	artisan: [
		{
			id: 'complete-profile',
			label: 'Completer mon profil',
			prompt: 'Aide-moi a completer mon profil artisan de facon professionnelle pour augmenter ma credibilite.',
			navigateTo: 'profile',
		},
		{
			id: 'calculate-quote',
			label: 'Calculer un devis',
			prompt: 'Donne-moi une methode detaillee et professionnelle pour calculer un devis en TND.',
			navigateTo: 'quotes',
		},
		{
			id: 'check-invoices',
			label: 'Verifier mes factures',
			prompt: 'Analyse mes factures et donne-moi un plan de priorites de paiement clair.',
			navigateTo: 'invoices',
		},
	],
	expert: [
		{
			id: 'complete-profile',
			label: 'Completer mon profil',
			prompt: 'Aide-moi a renforcer mon profil expert pour etre plus visible et credible.',
			navigateTo: 'profile',
		},
		{
			id: 'find-artisans',
			label: 'Trouver artisans',
			prompt: 'Donne-moi une strategie efficace pour identifier rapidement les bons artisans dans l annuaire.',
			navigateTo: 'directory',
		},
		{
			id: 'open-messages',
			label: 'Voir mes messages',
			prompt: 'Aide-moi a organiser mes conversations messages de maniere professionnelle.',
			navigateTo: 'messages',
		},
	],
	manufacturer: [
		{
			id: 'complete-profile',
			label: 'Completer mon profil',
			prompt: 'Aide-moi a completer mon profil fabricant avec une presentation professionnelle.',
			navigateTo: 'profile',
		},
		{
			id: 'check-products',
			label: 'Verifier mes produits',
			prompt: 'Donne-moi un plan pour mieux presenter et vendre mes produits sur BMP.tn.',
			navigateTo: 'products',
		},
		{
			id: 'check-orders',
			label: 'Verifier mes commandes',
			prompt: 'Propose-moi une methode efficace pour traiter mes commandes et respecter les delais.',
			navigateTo: 'orders',
		},
	],
};

const getInitialPosition = () => {
	if (typeof window === 'undefined') {
		return { x: EDGE_GAP, y: EDGE_GAP };
	}

	return {
		x: Math.max(EDGE_GAP, window.innerWidth - BUBBLE_SIZE - EDGE_GAP),
		y: Math.max(EDGE_GAP, window.innerHeight - BUBBLE_SIZE - EDGE_GAP),
	};
};

export default function CopilotChatWidget({ role, activeView, isVisible, onNavigate }: CopilotChatWidgetProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [showNudge, setShowNudge] = useState(false);
	const [context, setContext] = useState<UserContext>({
		userId: '',
		firstName: role === 'artisan' ? 'Amir' : role === 'expert' ? 'Expert' : 'Fabricant',
		lastName: '',
		role,
		profileCompletion: 20,
		subscriptionStatus: 'inactive',
	});
	const [position, setPosition] = useState(getInitialPosition);

	const listRef = useRef<HTMLDivElement | null>(null);
	const suppressClickRef = useRef(false);
	const dragRef = useRef({
		active: false,
		moved: false,
		offsetX: 0,
		offsetY: 0,
	});

	const roleTitle = role === 'artisan' ? 'Chantier' : role === 'expert' ? 'Expertise' : 'Production';
	const quickActions = QUICK_ACTIONS_BY_ROLE[role];
	const shouldRender = isVisible && safeText(activeView).toLowerCase() === 'home';

	const fullName = useMemo(() => {
		const full = `${context.firstName} ${context.lastName}`.trim();
		return full || context.firstName;
	}, [context.firstName, context.lastName]);

	const clampPosition = useCallback((x: number, y: number) => {
		if (typeof window === 'undefined') return { x, y };

		const maxX = Math.max(EDGE_GAP, window.innerWidth - BUBBLE_SIZE - EDGE_GAP);
		const maxY = Math.max(EDGE_GAP, window.innerHeight - BUBBLE_SIZE - EDGE_GAP);

		return {
			x: Math.min(Math.max(EDGE_GAP, x), maxX),
			y: Math.min(Math.max(EDGE_GAP, y), maxY),
		};
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined') return;

		setPosition((prev) => clampPosition(prev.x, prev.y));

		const onResize = () => {
			setPosition((prev) => clampPosition(prev.x, prev.y));
		};

		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, [clampPosition]);

	useEffect(() => {
		const onPointerMove = (event: PointerEvent) => {
			if (!dragRef.current.active) return;
			dragRef.current.moved = true;

			const nextX = event.clientX - dragRef.current.offsetX;
			const nextY = event.clientY - dragRef.current.offsetY;
			setPosition(clampPosition(nextX, nextY));
		};

		const onPointerUp = () => {
			if (!dragRef.current.active) return;
			if (dragRef.current.moved) {
				suppressClickRef.current = true;
			}
			dragRef.current.active = false;
			dragRef.current.moved = false;
		};

		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerUp);

		return () => {
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerUp);
		};
	}, [clampPosition]);

	const beginDrag = (event: React.PointerEvent<HTMLElement>) => {
		if (event.pointerType !== 'touch' && event.button !== 0) return;
		event.preventDefault();

		dragRef.current.active = true;
		dragRef.current.moved = false;
		dragRef.current.offsetX = event.clientX - position.x;
		dragRef.current.offsetY = event.clientY - position.y;
	};

	useEffect(() => {
		const loadUserContext = async () => {
			try {
				const token = getToken();
				if (!token) return;

				const response = await axios.get('/api/auth/me', {
					headers: { Authorization: `Bearer ${token}` },
				});

				const raw = response.data?.user ?? response.data ?? {};
				const completion = computeProfileCompletion(role, raw);

				const nextContext: UserContext = {
					userId: String(raw?._id || raw?.id || ''),
					firstName: safeText(raw?.firstName) || context.firstName,
					lastName: safeText(raw?.lastName),
					role,
					profileCompletion: completion,
					subscriptionStatus: safeText(raw?.subscription?.status) || 'inactive',
				};

				setContext(nextContext);

				const nudgeKey = `bmp-copilot-nudge-${role}-${nextContext.userId || 'default'}`;
				if (completion < 100 && !localStorage.getItem(nudgeKey)) {
					setShowNudge(true);
				}
			} catch (error) {
				console.error('Copilot context load failed:', error);
			}
		};

		loadUserContext();
	}, [context.firstName, role]);

	useEffect(() => {
		if (!isOpen || !listRef.current) return;
		listRef.current.scrollTop = listRef.current.scrollHeight;
	}, [isOpen, messages, isLoading]);

	useEffect(() => {
		if (!shouldRender) {
			setIsOpen(false);
			return;
		}

		if (!isOpen || messages.length > 0) return;

		const intro =
			context.profileCompletion < 100
				? `Bonjour ${fullName}, je suis Bmp-Bot. Je peux vous aider sur ${roleTitle.toLowerCase()}, navigation et operations BMP. Je peux aussi proposer des idees pour renforcer votre profil, si vous le souhaitez.`
				: `Bonjour ${fullName}, je suis Bmp-Bot. Je peux vous aider sur ${roleTitle.toLowerCase()}, navigation et operations BMP avec des reponses detaillees.`;

		setMessages([{ id: makeId(), role: 'assistant', text: intro }]);

		const nudgeKey = `bmp-copilot-nudge-${role}-${context.userId || 'default'}`;
		localStorage.setItem(nudgeKey, '1');
		setShowNudge(false);
	}, [context.profileCompletion, context.userId, fullName, isOpen, messages.length, role, roleTitle, shouldRender]);

	const sendMessage = useCallback(
		async (rawMessage: string, quickActionId?: string) => {
			const text = rawMessage.trim();
			if (!text || isLoading) return;

			const token = getToken();
			if (!token) {
				setMessages((prev) => [
					...prev,
					{ id: makeId(), role: 'assistant', text: 'Session expiree. Veuillez vous reconnecter.' },
				]);
				return;
			}

			const history = messages.slice(-10).map((entry) => ({
				role: entry.role,
				text: entry.text,
			}));

			setMessages((prev) => [...prev, { id: makeId(), role: 'user', text }]);
			setInput('');
			setIsLoading(true);

			try {
				const response = await axios.post(
					'/api/ai/copilot-chat',
					{
						message: text,
						quickAction: quickActionId || null,
						history,
						context: {
							role,
							currentView: activeView,
							profileCompletion: context.profileCompletion,
							subscriptionStatus: context.subscriptionStatus,
						},
					},
					{
						headers: { Authorization: `Bearer ${token}` },
					},
				);

				const answer = safeText(response.data?.reply) || 'Je reste disponible pour vous aider.';
				setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', text: answer }]);
			} catch (error) {
				console.error('Copilot request failed:', error);
				setMessages((prev) => [
					...prev,
					{
						id: makeId(),
						role: 'assistant',
						text: 'Je rencontre une indisponibilite temporaire. Je peux quand meme vous proposer un plan d action si vous reformulez votre besoin en une phrase claire.',
					},
				]);
			} finally {
				setIsLoading(false);
			}
		},
		[activeView, context.profileCompletion, context.subscriptionStatus, isLoading, messages, role],
	);

	const runQuickAction = (action: QuickAction) => {
		setIsOpen(true);
		if (action.navigateTo && onNavigate) {
			onNavigate(action.navigateTo);
		}
		void sendMessage(action.prompt, action.id);
	};

	const handleOpen = () => {
		setIsOpen(true);
		const nudgeKey = `bmp-copilot-nudge-${role}-${context.userId || 'default'}`;
		localStorage.setItem(nudgeKey, '1');
		setShowNudge(false);
	};

	const handleToggleClick = () => {
		if (suppressClickRef.current) {
			suppressClickRef.current = false;
			return;
		}

		if (isOpen) {
			setIsOpen(false);
		} else {
			handleOpen();
		}
	};

	const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		void sendMessage(input);
	};

	if (!shouldRender) return null;

	return (
		<div
			style={{
				position: 'fixed',
				left: position.x,
				top: position.y,
				zIndex: 2147483000,
				width: BUBBLE_SIZE,
				height: BUBBLE_SIZE,
			}}
		>
			{showNudge && !isOpen && (
				<button
					type="button"
					onClick={handleOpen}
					style={{
						position: 'absolute',
						right: 0,
						bottom: BUBBLE_SIZE + 12,
						maxWidth: 360,
						borderRadius: 16,
						border: '1px solid #bfdbfe',
						backgroundColor: '#ffffff',
						padding: '12px 14px',
						textAlign: 'left',
						fontSize: 14,
						color: '#334155',
						boxShadow: '0 14px 34px rgba(29, 78, 216, 0.20)',
						cursor: 'pointer',
					}}
				>
					<div
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: 6,
							borderRadius: 999,
							backgroundColor: '#eff6ff',
							padding: '2px 8px',
							fontSize: 11,
							fontWeight: 700,
							color: '#1d4ed8',
							marginBottom: 6,
						}}
					>
						<Sparkles size={12} />
						Bmp-Bot
					</div>
					<p style={{ margin: 0 }}>Bonjour {context.firstName}! Je peux vous aider rapidement sur vos actions BMP.</p>
				</button>
			)}

			{isOpen && (
				<section
					role="dialog"
					aria-modal="false"
					aria-label="Bmp-Bot"
					style={{
						position: 'absolute',
						right: 0,
						bottom: BUBBLE_SIZE + 12,
						width: `min(96vw, ${CHAT_PANEL_MAX_WIDTH}px)`,
						maxHeight: `min(88vh, ${CHAT_PANEL_MAX_HEIGHT}px)`,
						overflow: 'hidden',
						borderRadius: 16,
						border: '1px solid #bfdbfe',
						backgroundColor: '#ffffff',
						boxShadow: '0 24px 64px rgba(29, 78, 216, 0.30)',
					}}
				>
					<header
						onPointerDown={beginDrag}
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							padding: '10px 14px',
							color: '#ffffff',
							backgroundColor: BLUE_DARK,
							cursor: 'grab',
							userSelect: 'none',
							touchAction: 'none',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<div style={{ borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', padding: 6 }}>
								<Bot size={16} />
							</div>
							<div>
								<p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Bmp-Bot</p>
								<p style={{ margin: 0, fontSize: 11, color: '#dbeafe' }}>Copilote {roleTitle}</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							style={{
								border: 'none',
								borderRadius: 8,
								padding: 6,
								color: '#eff6ff',
								background: 'transparent',
								cursor: 'pointer',
							}}
							aria-label="Fermer"
						>
							<X size={16} />
						</button>
					</header>

					<div style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: 10 }}>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
							{quickActions.map((action) => (
								<button
									key={action.id}
									type="button"
									onClick={() => runQuickAction(action)}
									style={{
										borderRadius: 999,
										border: '1px solid #bfdbfe',
										backgroundColor: '#ffffff',
										padding: '5px 10px',
										fontSize: 13,
										fontWeight: 700,
										color: '#1d4ed8',
										cursor: 'pointer',
									}}
								>
									{action.label}
								</button>
							))}
						</div>
					</div>

					<div
						ref={listRef}
						style={{
							maxHeight: `calc(min(88vh, ${CHAT_PANEL_MAX_HEIGHT}px) - 188px)`,
							minHeight: 340,
							overflowY: 'auto',
							backgroundColor: '#ffffff',
							padding: 14,
						}}
					>
						{messages.map((message) => (
							<div
								key={message.id}
								style={{
									display: 'flex',
									justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
									marginBottom: 10,
								}}
							>
								<div
									style={{
										maxWidth: '88%',
										borderRadius: 14,
										padding: '9px 11px',
										fontSize: 15,
										lineHeight: 1.45,
										color: message.role === 'user' ? '#ffffff' : '#334155',
										backgroundColor: message.role === 'user' ? '#1d4ed8' : '#f8fafc',
										border: message.role === 'user' ? 'none' : '1px solid #e2e8f0',
										whiteSpace: 'pre-wrap',
									}}
								>
									{message.text}
								</div>
							</div>
						))}

						{isLoading && (
							<div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
								<div
									style={{
										display: 'inline-flex',
										alignItems: 'center',
										gap: 8,
										borderRadius: 14,
										border: '1px solid #e2e8f0',
										backgroundColor: '#f8fafc',
										padding: '8px 10px',
										fontSize: 14,
										color: '#475569',
									}}
								>
									<Loader2 size={14} className="animate-spin" />
									Bmp-Bot analyse votre demande...
								</div>
							</div>
						)}
					</div>

					<form onSubmit={onSubmit} style={{ borderTop: '1px solid #e2e8f0', backgroundColor: '#ffffff', padding: 12 }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<input
								value={input}
								onChange={(event) => setInput(event.target.value)}
								placeholder="Posez votre question..."
								disabled={isLoading}
								style={{
									height: 48,
									flex: 1,
									borderRadius: 12,
									border: '1px solid #cbd5e1',
									padding: '0 12px',
									fontSize: 15,
									color: '#334155',
									outline: 'none',
								}}
							/>
							<button
								type="submit"
								disabled={isLoading || input.trim().length === 0}
								style={{
									width: 48,
									height: 48,
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
									borderRadius: 12,
									border: 'none',
									backgroundColor: BLUE_DARK,
									color: '#ffffff',
									cursor: isLoading || input.trim().length === 0 ? 'not-allowed' : 'pointer',
									opacity: isLoading || input.trim().length === 0 ? 0.45 : 1,
								}}
								aria-label="Envoyer"
							>
								<Send size={18} />
							</button>
						</div>
					</form>
				</section>
			)}

			<button
				type="button"
				onPointerDown={beginDrag}
				onClick={handleToggleClick}
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					width: BUBBLE_SIZE,
					height: BUBBLE_SIZE,
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					borderRadius: 999,
					border: 'none',
					backgroundColor: BLUE_DARK,
					color: '#ffffff',
					boxShadow: '0 18px 38px rgba(29, 78, 216, 0.38)',
					cursor: 'grab',
					userSelect: 'none',
					touchAction: 'none',
				}}
				aria-label={isOpen ? 'Fermer le chatbot' : 'Ouvrir le chatbot'}
			>
				{showNudge && !isOpen && (
					<span
						style={{
							position: 'absolute',
							right: -2,
							top: -2,
							width: 12,
							height: 12,
							borderRadius: 999,
							border: '2px solid #ffffff',
							backgroundColor: '#34d399',
						}}
					/>
				)}
				{isOpen ? <X size={20} /> : <MessageSquare size={20} />}
			</button>
		</div>
	);
}
