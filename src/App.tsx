import { fetchAuthSession } from 'aws-amplify/auth';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { client } from './amplifyClient';
import './App.css';
import './KnowledgeBase.css';
import './AIChat.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type TicketCategory = 'HARDWARE' | 'SOFTWARE' | 'NETWORK' | 'ACCESS' | 'OTHER';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type WorkspaceView =
  | 'overview'
  | 'tickets'
  | 'assistant'
  | 'knowledge'
  | 'team'
  | 'reports'
  | 'settings';
type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'PENDING'
  | 'RESOLVED'
  | 'CLOSED';

type Ticket = {
  id: string;
  title: string;
  description: string;
  category?: TicketCategory | null;
  priority?: TicketPriority | null;
  status?: TicketStatus | null;
  assignedTo?: string | null;
  resolutionNotes?: string | null;
  createdAt?: string | null;
};

type KnowledgeArticle = {
  id: string;
  title: string;
  category: string;
  content: string;
  author?: string | null;
  createdAt?: string | null;
};

const KNOWLEDGE_CATEGORIES = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'ACCESS', 'SECURITY', 'GENERAL'];

function formatLabel(value?: string | null) {
  if (!value) return 'Not set';
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function Dashboard({ signOut, user }: any) {
  const [userRole, setUserRole] = useState<
    'EMPLOYEE' | 'TECHNICIAN' | 'ADMIN'
  >('EMPLOYEE');

  const [roleLoading, setRoleLoading] = useState(true);
const [activeView, setActiveView] = useState<WorkspaceView>('overview');
type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
const [chatInput, setChatInput] = useState('');
const [chatLoading, setChatLoading] = useState(false);
const [chatError, setChatError] = useState('');
async function sendChatMessage(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const message = chatInput.trim();
  if (!message || chatLoading) return;

  setChatMessages(previous => [
    ...previous,
    { role: 'user', content: message },
  ]);
  setChatInput('');
  setChatError('');
  setChatLoading(true);

  try {
    const conversation = [
  ...chatMessages.slice(-8),
  { role: 'user' as const, content: message },
]
  .map(item =>
    `${item.role === 'user' ? 'Employee' : 'CloudDesk AI'}: ${item.content}`
  )
  .join('\n\n');

const response = await client.queries.askCloudDeskAI({
  message: conversation.slice(-3000),
});

    if (response.errors?.length) {
      throw new Error(response.errors.map(item => item.message).join(', '));
    }

    const answer = response.data?.trim();

    if (!answer) {
      throw new Error('The AI assistant returned an empty response.');
    }

    setChatMessages(previous => [
      ...previous,
      { role: 'assistant', content: answer },
    ]);
  } catch (error) {
    setChatError(
      error instanceof Error ? error.message : 'Unable to contact CloudDesk AI.'
    );
  } finally {
    setChatLoading(false);
  }
}
  useEffect(() => {
    async function detectUserRole() {
      try {
        const session = await fetchAuthSession();

        const groups = session.tokens?.idToken?.payload[
          'cognito:groups'
        ] as string[] | undefined;

        if (groups?.includes('ADMINS')) {
          setUserRole('ADMIN');
        } else if (groups?.includes('TECHNICIANS')) {
          setUserRole('TECHNICIAN');
        } else {
          setUserRole('EMPLOYEE');
        }
      } catch (error) {
        console.error('Unable to identify user role:', error);
        setUserRole('EMPLOYEE');
      } finally {
        setRoleLoading(false);
      }
    }

    void detectUserRole();
  }, []);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('HARDWARE');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>('OPEN');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updatingTicket, setUpdatingTicket] = useState(false);
  const [takingTicketId, setTakingTicketId] = useState<string | null>(null);

  const [publishedArticles, setPublishedArticles] = useState<KnowledgeArticle[]>([]);
  const [draftArticles, setDraftArticles] = useState<KnowledgeArticle[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [knowledgeCategory, setKnowledgeCategory] = useState('ALL');
  const [showArticleEditor, setShowArticleEditor] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editingPublishedArticle, setEditingPublishedArticle] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [articleTitle, setArticleTitle] = useState('');
  const [articleCategory, setArticleCategory] = useState('GENERAL');
  const [articleContent, setArticleContent] = useState('');

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await client.models.Ticket.list({ limit: 100 });

      if (response.errors?.length) {
        throw new Error(response.errors.map(item => item.message).join(', '));
      }

      setTickets((response.data ?? []) as Ticket[]);
    } catch (err) {
      console.error('Unable to load tickets:', err);
      setError(err instanceof Error ? err.message : 'Unable to load your tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(ticket => ticket.status === 'OPEN').length,
    progress: tickets.filter(ticket => ticket.status === 'IN_PROGRESS').length,
    resolved: tickets.filter(ticket => ticket.status === 'RESOLVED').length,
  }), [tickets]);

  const currentUserEmail = String(user?.signInDetails?.loginId || '').trim().toLowerCase();
  const isSupportStaff = userRole === 'TECHNICIAN' || userRole === 'ADMIN';

  const loadKnowledge = useCallback(async () => {
    setKnowledgeLoading(true);
    try {
      const publishedResponse = await client.models.PublishedKnowledgeArticle.list({ limit: 100 });
      if (publishedResponse.errors?.length) {
        throw new Error(publishedResponse.errors.map(item => item.message).join(', '));
      }
      setPublishedArticles((publishedResponse.data ?? []) as KnowledgeArticle[]);

      if (isSupportStaff) {
        const draftResponse = await client.models.KnowledgeArticle.list({ limit: 100 });
        if (draftResponse.errors?.length) {
          throw new Error(draftResponse.errors.map(item => item.message).join(', '));
        }
        setDraftArticles((draftResponse.data ?? []) as KnowledgeArticle[]);
      } else {
        setDraftArticles([]);
      }
    } catch (err) {
      console.error('Unable to load knowledge articles:', err);
      setError(err instanceof Error ? err.message : 'Unable to load the Knowledge Base.');
    } finally {
      setKnowledgeLoading(false);
    }
  }, [isSupportStaff]);

  useEffect(() => {
    if (activeView === 'knowledge' && !roleLoading) void loadKnowledge();
  }, [activeView, roleLoading, loadKnowledge]);

  function resetArticleEditor() {
    setShowArticleEditor(false);
    setEditingArticleId(null);
    setEditingPublishedArticle(false);
    setArticleTitle('');
    setArticleCategory('GENERAL');
    setArticleContent('');
  }

  function startNewArticle() {
    setSelectedArticle(null);
    setEditingArticleId(null);
    setEditingPublishedArticle(false);
    setArticleTitle('');
    setArticleCategory('GENERAL');
    setArticleContent('');
    setShowArticleEditor(true);
  }

  function startArticleEdit(article: KnowledgeArticle, published: boolean) {
    setSelectedArticle(null);
    setEditingArticleId(article.id);
    setEditingPublishedArticle(published);
    setArticleTitle(article.title);
    setArticleCategory(article.category || 'GENERAL');
    setArticleContent(article.content);
    setShowArticleEditor(true);
  }

  async function saveKnowledgeArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupportStaff) return;
    setKnowledgeSaving(true);
    setError('');
    setSuccess('');
    const payload = {
      title: articleTitle.trim(),
      category: articleCategory,
      content: articleContent.trim(),
      author: currentUserEmail || 'CloudDesk Support Team',
    };

    try {
      const response = editingArticleId
        ? editingPublishedArticle
          ? await client.models.PublishedKnowledgeArticle.update({ id: editingArticleId, ...payload })
          : await client.models.KnowledgeArticle.update({ id: editingArticleId, ...payload, published: false })
        : await client.models.KnowledgeArticle.create({ ...payload, published: false });

      if (response.errors?.length) throw new Error(response.errors.map(item => item.message).join(', '));
      if (!response.data) throw new Error('The article could not be saved. Please try again.');
      setSuccess(editingArticleId ? 'Knowledge article updated.' : 'Draft saved. Publish it when it is ready for employees.');
      resetArticleEditor();
      await loadKnowledge();
    } catch (err) {
      console.error('Unable to save knowledge article:', err);
      setError(err instanceof Error ? err.message : 'Unable to save this article.');
    } finally {
      setKnowledgeSaving(false);
    }
  }

  async function publishKnowledgeArticle(article: KnowledgeArticle) {
    if (!isSupportStaff) return;
    setKnowledgeSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await client.models.PublishedKnowledgeArticle.create({
        title: article.title,
        category: article.category,
        content: article.content,
        author: article.author || currentUserEmail || 'CloudDesk Support Team',
      });
      if (response.errors?.length) throw new Error(response.errors.map(item => item.message).join(', '));
      if (!response.data) throw new Error('Publishing failed. The draft has been kept.');
      const deleteResponse = await client.models.KnowledgeArticle.delete({ id: article.id });
      if (deleteResponse.errors?.length) {
        setSuccess('Article published. The original draft could not be removed; please delete the duplicate draft.');
      } else {
        setSuccess('Article published and is now available to employees.');
      }
      await loadKnowledge();
    } catch (err) {
      console.error('Unable to publish knowledge article:', err);
      setError(err instanceof Error ? err.message : 'Unable to publish this article.');
    } finally {
      setKnowledgeSaving(false);
    }
  }

  async function deleteKnowledgeArticle(article: KnowledgeArticle, published: boolean) {
    if (!isSupportStaff || !window.confirm(`Delete “${article.title}”? This cannot be undone.`)) return;
    setKnowledgeSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = published
        ? await client.models.PublishedKnowledgeArticle.delete({ id: article.id })
        : await client.models.KnowledgeArticle.delete({ id: article.id });
      if (response.errors?.length) throw new Error(response.errors.map(item => item.message).join(', '));
      setSuccess(published ? 'Published article deleted.' : 'Draft deleted.');
      if (selectedArticle?.id === article.id) setSelectedArticle(null);
      await loadKnowledge();
    } catch (err) {
      console.error('Unable to delete knowledge article:', err);
      setError(err instanceof Error ? err.message : 'Unable to delete this article.');
    } finally {
      setKnowledgeSaving(false);
    }
  }

  const filteredPublishedArticles = publishedArticles.filter(article => {
    const matchesCategory = knowledgeCategory === 'ALL' || article.category === knowledgeCategory;
    const query = knowledgeSearch.trim().toLowerCase();
    const matchesSearch = !query || `${article.title} ${article.category} ${article.content}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });
  const activeTickets = tickets.filter(ticket =>
    ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED'
  );
  const myQueueTickets = activeTickets.filter(ticket =>
    (ticket.assignedTo || '').trim().toLowerCase() === currentUserEmail && currentUserEmail !== ''
  );
  const unassignedTickets = activeTickets.filter(ticket => !(ticket.assignedTo || '').trim());
  const workspaceTickets = userRole === 'ADMIN'
    ? activeTickets
    : [...myQueueTickets, ...unassignedTickets.filter(ticket =>
        !myQueueTickets.some(assigned => assigned.id === ticket.id)
      )];

  async function handleTakeTicket(ticket: Ticket) {
    if (!currentUserEmail || ticket.assignedTo?.trim()) return;

    setTakingTicketId(ticket.id);
    setError('');
    setSuccess('');

    try {
      const response = await client.models.Ticket.update({
        id: ticket.id,
        assignedTo: currentUserEmail,
        status: 'IN_PROGRESS',
      });

      if (response.errors?.length) {
        throw new Error(response.errors.map(item => item.message).join(', '));
      }

      if (!response.data) {
        throw new Error('The ticket could not be assigned. Please refresh and try again.');
      }

      setSuccess(`Ticket CD-${ticket.id.slice(0, 8).toUpperCase()} assigned to you.`);
      await loadTickets();
    } catch (err) {
      console.error('Unable to take ticket:', err);
      setError(err instanceof Error ? err.message : 'Unable to assign this ticket.');
    } finally {
      setTakingTicketId(null);
    }
  }

  function openTicketManagement(ticket: Ticket) {
    setSelectedTicket(ticket);
    setAssignedTo(ticket.assignedTo || '');
    setTicketStatus(ticket.status || 'OPEN');
    setResolutionNotes(ticket.resolutionNotes || '');
    setError('');
    setSuccess('');
  }

  async function handleUpdateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTicket) return;

    setUpdatingTicket(true);
    setError('');
    setSuccess('');

    try {
      const response = await client.models.Ticket.update({
        id: selectedTicket.id,
        assignedTo: assignedTo.trim() || undefined,
        status: ticketStatus,
        resolutionNotes: resolutionNotes.trim() || undefined,
      });

      if (response.errors?.length) {
        throw new Error(response.errors.map(item => item.message).join(', '));
      }

      if (!response.data) {
        throw new Error('The ticket update could not be saved.');
      }

      setSelectedTicket(null);
      setSuccess('Ticket updated successfully.');
    
      await loadTickets();
    } catch (err) {
      console.error('Unable to update ticket:', err);
      setError(err instanceof Error ? err.message : 'Unable to update ticket.');
    } finally {
      setUpdatingTicket(false);
    }
  }

  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await client.models.Ticket.create({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status: 'OPEN',
      });

      if (response.errors?.length) {
        throw new Error(response.errors.map(item => item.message).join(', '));
      }

      if (!response.data) {
        throw new Error('The ticket could not be saved. Please try again.');
      }

      setTitle('');
      setDescription('');
      setCategory('HARDWARE');
      setPriority('MEDIUM');
      setShowForm(false);
      setSuccess('Your support ticket has been submitted successfully.');

      await loadTickets();
    } catch (err) {
      console.error('Unable to create ticket:', err);
      setError(err instanceof Error ? err.message : 'Unable to submit your ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">C</div>
          <div>
            <h2>CloudDesk</h2>
            <span>IT SERVICE MANAGEMENT</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

<nav>
  {([
    ['overview', '▦', 'Overview'],
    ['tickets', '▤', 'My Tickets'],
    ['assistant', '✦', 'AI Assistant'],
    ['knowledge', '▧', 'Knowledge Base'],
  ] as const).map(([view, icon, label]) => (
    <a
      key={view}
      className={`nav-item ${activeView === view ? 'active' : ''}`}
      href={`#${view}`}
      onClick={() => setActiveView(view)}
    >
      {icon} <span>{label}</span>
    </a>
  ))}
</nav>

<div className="nav-label management-label">MANAGEMENT</div>

<nav>
  {([
    ['team', '♙', 'Technician Team'],
    ['reports', '▥', 'Reports'],
    ['settings', '⚙', 'Settings'],
  ] as const).map(([view, icon, label]) => (
    <a
      key={view}
      className={`nav-item ${activeView === view ? 'active' : ''}`}
      href={`#${view}`}
      onClick={() => setActiveView(view)}
    >
      {icon} <span>{label}</span>
    </a>
  ))}
</nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">?</div>
            <strong>Need assistance?</strong>
            <p>Our support team is here to help.</p>
            <a href="#tickets">View support tickets →</a>
          </div>
          <button className="signout-button" onClick={signOut}>
            ↪ Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace / <strong>{formatLabel(activeView)}</strong></div>
          <div className="user-area">
            <div className="notification">♧</div>
            <div className="user-avatar">
              {(user?.signInDetails?.loginId || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <strong>{user?.signInDetails?.loginId || 'CloudDesk User'}</strong>
<span>
  {roleLoading
    ? 'Checking access...'
    : userRole === 'ADMIN'
      ? 'Administrator account'
      : userRole === 'TECHNICIAN'
        ? 'Technician account'
        : 'Employee account'}
</span>            </div>
          </div>
        </header>

        <section className="page-content" id="overview">
        {activeView === 'overview' && (
          <>
          <div className="welcome-row">
            <div>
              <span className="eyebrow">IT OPERATIONS PORTAL</span>
              <h1>Good day. Welcome back.</h1>
              <p>Here is what's happening with your IT support requests.</p>
            </div>
            <button className="primary-button" onClick={() => {
              setError('');
              setSuccess('');
              setShowForm(true);
            }}>
              + Create a ticket
            </button>
          </div>

          {error && <div className="ticket-message error-message">{error}</div>}
          {success && <div className="ticket-message success-message">{success}</div>}

          <div className="notice">
            <span className="notice-icon">i</span>
            <span>Live ticket data is loaded from your CloudDesk AWS backend. Your account displays tickets it is authorized to access.</span>
          </div>

          <div className="section-heading">
            <div>
              <h2>Support overview</h2>
              <p>A snapshot of your service desk activity.</p>
            </div>
            <span className="period-label">LIVE DATA</span>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-top"><span>Total tickets</span><span className="stat-icon blue">▤</span></div>
              <strong>{stats.total}</strong>
              <small>Submitted requests you can access</small>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Open tickets</span><span className="stat-icon orange">◷</span></div>
              <strong>{stats.open}</strong>
              <small>Awaiting attention</small>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>In progress</span><span className="stat-icon purple">↻</span></div>
              <strong>{stats.progress}</strong>
              <small>Currently being handled</small>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Resolved</span><span className="stat-icon green">✓</span></div>
              <strong>{stats.resolved}</strong>
              <small>Successfully completed</small>
            </div>
          </div>

          {isSupportStaff && (
            <section className="tickets-section" id="technician-workspace">
              <div className="section-heading">
                <div>
                  <h2>{userRole === 'ADMIN' ? 'Support operations queue' : 'Technician workspace'}</h2>
                  <p>{userRole === 'ADMIN'
                    ? 'Monitor all active requests across the service desk.'
                    : 'Work on tickets assigned to your account and pick up unassigned requests.'}</p>
                </div>
                <span className="period-label">{workspaceTickets.length} ACTIVE</span>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top"><span>Assigned to me</span><span className="stat-icon blue">♙</span></div>
                  <strong>{myQueueTickets.length}</strong>
                  <small>Matched to your sign-in email</small>
                </div>
                <div className="stat-card">
                  <div className="stat-top"><span>Unassigned</span><span className="stat-icon orange">◷</span></div>
                  <strong>{unassignedTickets.length}</strong>
                  <small>Waiting for an owner</small>
                </div>
                <div className="stat-card">
                  <div className="stat-top"><span>Active tickets</span><span className="stat-icon purple">↻</span></div>
                  <strong>{userRole === 'ADMIN' ? activeTickets.length : workspaceTickets.length}</strong>
                  <small>{userRole === 'ADMIN' ? 'Across all technicians' : 'In your work queue'}</small>
                </div>
                <div className="stat-card">
                  <div className="stat-top"><span>High priority</span><span className="stat-icon green">✓</span></div>
                  <strong>{activeTickets.filter(ticket => ticket.priority === 'HIGH' || ticket.priority === 'URGENT').length}</strong>
                  <small>High and urgent active requests</small>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>REFERENCE</th>
                      <th>ISSUE</th>
                      <th>ASSIGNED TO</th>
                      <th>PRIORITY</th>
                      <th>STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6}>Loading work queue...</td></tr>
                    ) : workspaceTickets.length === 0 ? (
                      <tr><td colSpan={6}>No active tickets in this queue.</td></tr>
                    ) : (
                      [...workspaceTickets]
                        .sort((a, b) => {
                          const priorityRank: Record<TicketPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                          return priorityRank[a.priority || 'MEDIUM'] - priorityRank[b.priority || 'MEDIUM'];
                        })
                        .map(ticket => (
                          <tr key={`queue-${ticket.id}`}>
                            <td className="ticket-id">CD-{ticket.id.slice(0, 8).toUpperCase()}</td>
                            <td className="ticket-title">{ticket.title}</td>
                            <td>{ticket.assignedTo || 'Unassigned'}</td>
                            <td><span className={`priority ${(ticket.priority || 'medium').toLowerCase()}`}>{formatLabel(ticket.priority)}</span></td>
                            <td><span className={`status ${(ticket.status || 'open').toLowerCase().replaceAll('_', '-')}`}>{formatLabel(ticket.status)}</span></td>
                            <td>
                              {!ticket.assignedTo && userRole === 'TECHNICIAN' ? (
                                <button
                                  type="button"
                                  className="view-all"
                                  onClick={() => void handleTakeTicket(ticket)}
                                  disabled={takingTicketId === ticket.id || !currentUserEmail}
                                >
                                  {takingTicketId === ticket.id ? 'Taking...' : 'Take ticket'}
                                </button>
                              ) : (
                                <button type="button" className="view-all" onClick={() => openTicketManagement(ticket)}>
                                  {ticket.assignedTo ? 'Manage' : 'Assign'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
              {userRole === 'TECHNICIAN' && (
                <p className="notice">To see a ticket under “Assigned to me”, assign it using this account's sign-in email: {user?.signInDetails?.loginId || 'your email'}.</p>
              )}
            </section>
          )}

          {userRole === 'ADMIN' && (
            <section className="tickets-section" id="admin-workload">
              <div className="section-heading">
                <div>
                  <h2>Admin technician workload</h2>
                  <p>Workload based on technicians currently assigned to tickets.</p>
                </div>
                <span className="period-label">LIVE OVERVIEW</span>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top"><span>Technicians with tickets</span><span className="stat-icon blue">♙</span></div>
                  <strong>{new Set(tickets.map(ticket => (ticket.assignedTo || '').trim().toLowerCase()).filter(Boolean)).size}</strong>
                  <small>Distinct assignees in ticket records</small>
                </div>
                <div className="stat-card">
                  <div className="stat-top"><span>Unassigned requests</span><span className="stat-icon orange">◷</span></div>
                  <strong>{tickets.filter(ticket => !ticket.assignedTo?.trim() && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED').length}</strong>
                  <small>Active tickets awaiting assignment</small>
                </div>
                <div className="stat-card">
                  <div className="stat-top"><span>Active assigned</span><span className="stat-icon purple">↻</span></div>
                  <strong>{tickets.filter(ticket => Boolean(ticket.assignedTo?.trim()) && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED').length}</strong>
                  <small>Currently owned by a technician</small>
                </div>
                <div className="stat-card">
                  <div className="stat-top"><span>Resolved</span><span className="stat-icon green">✓</span></div>
                  <strong>{tickets.filter(ticket => ticket.status === 'RESOLVED').length}</strong>
                  <small>Tickets marked resolved</small>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>TECHNICIAN / ASSIGNEE</th>
                      <th>ACTIVE</th>
                      <th>RESOLVED</th>
                      <th>TOTAL ASSIGNED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const assignees = Array.from(new Set(
                        tickets.map(ticket => (ticket.assignedTo || '').trim()).filter(Boolean)
                      )).sort((a, b) => a.localeCompare(b));

                      if (assignees.length === 0) {
                        return <tr><td colSpan={4}>No assigned technicians found in ticket records yet.</td></tr>;
                      }

                      return assignees.map(assignee => {
                        const assignedTickets = tickets.filter(ticket =>
                          (ticket.assignedTo || '').trim().toLowerCase() === assignee.toLowerCase()
                        );
                        const activeCount = assignedTickets.filter(ticket =>
                          ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED'
                        ).length;
                        const resolvedCount = assignedTickets.filter(ticket => ticket.status === 'RESOLVED').length;

                        return (
                          <tr key={assignee}>
                            <td className="ticket-title">{assignee}</td>
                            <td>{activeCount}</td>
                            <td>{resolvedCount}</td>
                            <td>{assignedTickets.length}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              <p className="notice">This report counts assignees found in ticket records. It does not represent every registered Cognito technician unless they have been assigned at least one ticket.</p>
            </section>
          )}
  </>
)}
{(activeView === 'overview' || activeView === 'tickets') && (
          <section className="tickets-section" id="tickets">
            <div className="section-heading">
              <div>
                <h2>{activeView === 'tickets' ? 'My Tickets' : 'Recent support tickets'}</h2>
                <p>{activeView === 'tickets' ? 'View and manage your IT support requests.' : 'Track the latest IT requests.'}</p>
              </div>
              <button className="view-all" onClick={() => void loadTickets()}>
                Refresh tickets ↻
              </button>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>REFERENCE</th>
                    <th>ISSUE</th>
                    <th>CATEGORY</th>
                    <th>PRIORITY</th>
                    <th>STATUS</th>
                    <th>CREATED</th>
                    {(userRole === 'TECHNICIAN' || userRole === 'ADMIN') && (
                      <th>ACTIONS</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={userRole === 'TECHNICIAN' || userRole === 'ADMIN' ? 7 : 6}>Loading your tickets...</td></tr>
                  ) : tickets.length === 0 ? (
                    <tr><td colSpan={userRole === 'TECHNICIAN' || userRole === 'ADMIN' ? 7 : 6}>No tickets found. Create your first support ticket to get started.</td></tr>
                  ) : (
                    [...tickets]
                      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
                      .map(ticket => (
                        <tr key={ticket.id}>
                          <td className="ticket-id">CD-{ticket.id.slice(0, 8).toUpperCase()}</td>
                          <td className="ticket-title">{ticket.title}</td>
                          <td>{formatLabel(ticket.category)}</td>
                          <td>
                            <span className={`priority ${(ticket.priority || 'medium').toLowerCase()}`}>
                              {formatLabel(ticket.priority)}
                            </span>
                          </td>
                          <td>
                            <span className={`status ${(ticket.status || 'open').toLowerCase().replaceAll('_', '-')}`}>
                              {formatLabel(ticket.status)}
                            </span>
                          </td>
                          <td>{formatDate(ticket.createdAt)}</td>
                          {(userRole === 'TECHNICIAN' || userRole === 'ADMIN') && (
                            <td>
                              <button
                                type="button"
                                className="view-all"
                                onClick={() => openTicketManagement(ticket)}
                              >
                                Manage
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {activeView === 'overview' && (
            <div className="bottom-grid">
              <div className="info-card">
                <span className="info-icon">▧</span>
                <div>
                  <h3>Knowledge Base</h3>
                  <p>Find troubleshooting guides and answers to common IT issues.</p>
                  <a href="#knowledge" onClick={() => setActiveView('knowledge')}>Explore resources →</a>
                </div>
              </div>
              <div className="info-card">
                <span className="info-icon">♙</span>
                <div>
                  <h3>IT Support Team</h3>
                  <p>Get assistance with hardware, software and network issues.</p>
                  <a href="#team" onClick={() => setActiveView('team')}>View team workspace →</a>
                </div>
              </div>
            </div>
          )}

          {activeView === 'assistant' && (
  <section className="workspace-page ai-workspace" id="assistant">
    <div className="section-heading">
      <div>
        <h2>CloudDesk AI Assistant</h2>
        <p>Your intelligent IT support assistant, powered by Amazon Bedrock.</p>
      </div>
      <span className="ai-status">AI ONLINE</span>
    </div>

    <div className="ai-chat-container">
      <div className="ai-chat-header">
        <div className="ai-avatar">✦</div>
        <div>
          <h3>CloudDesk AI</h3>
          <p>IT Support Assistant</p>
        </div>
      </div>

      <div className="ai-chat-messages" aria-live="polite">
        {chatMessages.length === 0 && (
          <div className="ai-welcome">
            <div className="ai-welcome-icon">✦</div>
            <h3>How can I help you today?</h3>
            <p>
              Describe your IT problem. I can help troubleshoot networks,
              Windows, hardware, software and account access.
            </p>
            <div className="ai-suggestions">
              <span>My Wi-Fi keeps disconnecting</span>
              <span>My computer is running slowly</span>
              <span>I cannot access my email</span>
            </div>
          </div>
        )}

        {chatMessages.map((message, index) => (
          <div
            key={index}
            className={`ai-message ${message.role}`}
          >
            <div className="ai-message-label">
              {message.role === 'user' ? 'You' : 'CloudDesk AI'}
            </div>
            <div className="ai-message-content">
  {message.role === 'assistant' ? (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {message.content.replace(/\\([*_`#])/g, '$1')}
    </ReactMarkdown>
  ) : (
    message.content
  )}
</div>
          </div>
        ))}

        {chatLoading && (
          <div className="ai-message assistant">
            <div className="ai-message-label">CloudDesk AI</div>
            <div className="ai-message-content ai-typing">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {chatError && (
        <div className="ticket-message error-message">
          {chatError}
        </div>
      )}

      <form className="ai-chat-form" onSubmit={sendChatMessage}>
        <textarea
          value={chatInput}
          onChange={event => setChatInput(event.target.value)}
          placeholder="Describe your IT issue..."
          rows={2}
          maxLength={3000}
          disabled={chatLoading}
          required
        />
        <button
          type="submit"
          className="primary-button"
          disabled={chatLoading || !chatInput.trim()}
        >
          {chatLoading ? 'Sending...' : 'Send message →'}
        </button>
      </form>

      <p className="ai-disclaimer">
        Do not share passwords, MFA codes or other sensitive credentials.
      </p>
    </div>
  </section>
)}
          {activeView === 'knowledge' && (
            <section className="workspace-page knowledge-workspace" id="knowledge">
              <div className="section-heading">
                <div>
                  <h2>Knowledge Base</h2>
                  <p>Search practical guides for common IT support issues.</p>
                </div>
                {isSupportStaff && (
                  <button type="button" className="primary-button" onClick={startNewArticle}>
                    + Create article
                  </button>
                )}
              </div>

              {error && <div className="ticket-message error-message">{error}</div>}
              {success && <div className="ticket-message success-message">{success}</div>}

              <div className="kb-toolbar">
                <input
                  type="search"
                  value={knowledgeSearch}
                  onChange={event => setKnowledgeSearch(event.target.value)}
                  placeholder="Search articles, topics or keywords..."
                  aria-label="Search knowledge articles"
                />
                <select value={knowledgeCategory} onChange={event => setKnowledgeCategory(event.target.value)} aria-label="Filter articles by category">
                  <option value="ALL">All categories</option>
                  {KNOWLEDGE_CATEGORIES.map(item => <option key={item} value={item}>{formatLabel(item)}</option>)}
                </select>
                <button type="button" className="secondary-button" onClick={() => void loadKnowledge()} disabled={knowledgeLoading || knowledgeSaving}>
                  Refresh
                </button>
              </div>

              {showArticleEditor && (
                <form className="kb-editor" onSubmit={saveKnowledgeArticle}>
                  <div className="kb-editor-heading">
                    <div>
                      <h3>{editingArticleId ? 'Edit article' : 'Create knowledge article'}</h3>
                      <p>{editingPublishedArticle ? 'Changes will be visible to employees immediately.' : 'Save as a draft first. Only support staff can see drafts.'}</p>
                    </div>
                    <button type="button" className="kb-close" onClick={resetArticleEditor} aria-label="Close editor">×</button>
                  </div>
                  <label>Article title<input required maxLength={140} value={articleTitle} onChange={event => setArticleTitle(event.target.value)} placeholder="e.g. Troubleshooting a slow Wi-Fi connection" /></label>
                  <label>Category<select value={articleCategory} onChange={event => setArticleCategory(event.target.value)}>{KNOWLEDGE_CATEGORIES.map(item => <option key={item} value={item}>{formatLabel(item)}</option>)}</select></label>
                  <label>Article content<textarea required rows={9} value={articleContent} onChange={event => setArticleContent(event.target.value)} placeholder="Write clear steps, checks, and the expected outcome..." /></label>
                  <div className="kb-editor-actions">
                    <button type="button" className="secondary-button" onClick={resetArticleEditor}>Cancel</button>
                    <button type="submit" className="primary-button" disabled={knowledgeSaving}>{knowledgeSaving ? 'Saving...' : 'Save draft'}</button>
                  </div>
                </form>
              )}

              {selectedArticle && (
                <article className="kb-article-detail">
                  <button type="button" className="kb-back" onClick={() => setSelectedArticle(null)}>← Back to articles</button>
                  <div className="kb-article-meta"><span>{formatLabel(selectedArticle.category)}</span><span>Published guide</span></div>
                  <h3>{selectedArticle.title}</h3>
                  <p className="kb-byline">By {selectedArticle.author || 'CloudDesk Support Team'} · {formatDate(selectedArticle.createdAt)}</p>
                  <div className="kb-article-content">{selectedArticle.content}</div>
                  {isSupportStaff && <div className="kb-card-actions">
                    <button type="button" className="secondary-button" onClick={() => startArticleEdit(selectedArticle, true)}>Edit article</button>
                    <button type="button" className="kb-danger" onClick={() => void deleteKnowledgeArticle(selectedArticle, true)} disabled={knowledgeSaving}>Delete</button>
                  </div>}
                </article>
              )}

              {!selectedArticle && (
                <>
                  {knowledgeLoading ? <div className="kb-empty">Loading knowledge articles...</div> : filteredPublishedArticles.length === 0 ? (
                    <div className="kb-empty">
                      <div className="kb-empty-icon">▤</div>
                      <h3>{knowledgeSearch || knowledgeCategory !== 'ALL' ? 'No matching articles' : 'No published articles yet'}</h3>
                      <p>{knowledgeSearch || knowledgeCategory !== 'ALL' ? 'Try another search term or category.' : isSupportStaff ? 'Create your first support guide and publish it when it is ready.' : 'Your support team has not published any guides yet.'}</p>
                    </div>
                  ) : (
                    <div className="kb-article-grid">
                      {filteredPublishedArticles.map(article => (
                        <article className="kb-article-card" key={article.id}>
                          <span className="kb-category">{formatLabel(article.category)}</span>
                          <h3>{article.title}</h3>
                          <p>{article.content.length > 150 ? `${article.content.slice(0, 150)}…` : article.content}</p>
                          <div className="kb-card-footer">
                            <small>{article.author || 'CloudDesk Support Team'}</small>
                            <button type="button" onClick={() => setSelectedArticle(article)}>Read guide →</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  {isSupportStaff && (
                    <div className="kb-drafts-section">
                      <div className="kb-drafts-heading"><div><h3>Drafts & legacy articles</h3><p>Only technicians and administrators can access this area.</p></div><span>{draftArticles.length}</span></div>
                      {draftArticles.length === 0 ? <p className="kb-no-drafts">No drafts waiting for review.</p> : draftArticles.map(article => (
                        <div className="kb-draft-row" key={article.id}>
                          <div><strong>{article.title}</strong><small>{formatLabel(article.category)} · {formatDate(article.createdAt)}</small></div>
                          <div className="kb-card-actions">
                            <button type="button" className="secondary-button" onClick={() => startArticleEdit(article, false)}>Edit</button>
                            <button type="button" className="primary-button" onClick={() => void publishKnowledgeArticle(article)} disabled={knowledgeSaving}>Publish</button>
                            <button type="button" className="kb-danger" onClick={() => void deleteKnowledgeArticle(article, false)} disabled={knowledgeSaving}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {activeView === 'team' && (
            <section className="workspace-page" id="team">
              <div className="section-heading">
                <div>
                  <h2>Technician Team</h2>
                  <p>Review current ticket assignments and service desk workload.</p>
                </div>
              </div>
              {userRole === 'ADMIN' || userRole === 'TECHNICIAN' ? (
                <>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-top"><span>Active tickets</span></div>
                      <strong>{activeTickets.length}</strong>
                      <small>Requests not yet resolved or closed</small>
                    </div>
                    <div className="stat-card">
                      <div className="stat-top"><span>Unassigned tickets</span></div>
                      <strong>{unassignedTickets.length}</strong>
                      <small>Waiting for a technician</small>
                    </div>
                    <div className="stat-card">
                      <div className="stat-top"><span>Technicians with assignments</span></div>
                      <strong>{new Set(tickets.map(ticket => (ticket.assignedTo || '').trim().toLowerCase()).filter(Boolean)).size}</strong>
                      <small>Distinct assignees in ticket records</small>
                    </div>
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>TECHNICIAN / ASSIGNEE</th>
                          <th>ACTIVE</th>
                          <th>RESOLVED</th>
                          <th>TOTAL ASSIGNED</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const assignees = Array.from(new Set(
                            tickets.map(ticket => (ticket.assignedTo || '').trim()).filter(Boolean)
                          )).sort((a, b) => a.localeCompare(b));

                          if (assignees.length === 0) {
                            return <tr><td colSpan={4}>No assigned technicians found in ticket records yet.</td></tr>;
                          }

                          return assignees.map(assignee => {
                            const assignedTickets = tickets.filter(ticket =>
                              (ticket.assignedTo || '').trim().toLowerCase() === assignee.toLowerCase()
                            );
                            return (
                              <tr key={assignee}>
                                <td className="ticket-title">{assignee}</td>
                                <td>{assignedTickets.filter(ticket => ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED').length}</td>
                                <td>{assignedTickets.filter(ticket => ticket.status === 'RESOLVED').length}</td>
                                <td>{assignedTickets.length}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <p className="notice">This view reports assignees found in ticket records. It does not list every Cognito user in the technician group.</p>
                </>
              ) : (
                <div className="notice">The technician workload view is available to technician and administrator accounts.</div>
              )}
            </section>
          )}

          {activeView === 'reports' && (
            <section className="workspace-page" id="reports">
              <div className="section-heading">
                <div>
                  <h2>Reports and Analytics</h2>
                  <p>Live service desk metrics based on tickets your account can access.</p>
                </div>
                <button type="button" className="view-all" onClick={() => void loadTickets()}>Refresh data ↻</button>
              </div>
              <div className="stats-grid">
                <div className="stat-card"><div className="stat-top"><span>Total tickets</span></div><strong>{stats.total}</strong><small>Accessible ticket records</small></div>
                <div className="stat-card"><div className="stat-top"><span>Open</span></div><strong>{stats.open}</strong><small>Awaiting attention</small></div>
                <div className="stat-card"><div className="stat-top"><span>In progress</span></div><strong>{stats.progress}</strong><small>Being handled</small></div>
                <div className="stat-card"><div className="stat-top"><span>Resolved</span></div><strong>{stats.resolved}</strong><small>Marked as resolved</small></div>
              </div>
              <div className="section-heading">
                <div><h2>Tickets by category</h2><p>Distribution across recorded support categories.</p></div>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>CATEGORY</th><th>TICKET COUNT</th></tr></thead>
                  <tbody>
                    {(['HARDWARE', 'SOFTWARE', 'NETWORK', 'ACCESS', 'OTHER'] as TicketCategory[]).map(item => (
                      <tr key={item}>
                        <td>{formatLabel(item)}</td>
                        <td>{tickets.filter(ticket => ticket.category === item).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeView === 'settings' && (
            <section className="workspace-page" id="settings">
              <div className="section-heading">
                <div>
                  <h2>Settings</h2>
                  <p>Account information and CloudDesk preferences.</p>
                </div>
              </div>
              <div className="info-card">
                <div>
                  <h3>Signed-in account</h3>
                  <p>Email: {user?.signInDetails?.loginId || 'Not available'}</p>
                  <p>Role: {roleLoading ? 'Checking access...' : formatLabel(userRole)}</p>
                </div>
              </div>
              <div className="notice">Account security, notification preferences and profile management will be added in a later release.</div>
            </section>
          )}

          <footer>CloudDesk IT Service Management <span>Built for better IT support.</span></footer>
        </section>
      </main>

      {selectedTicket && (
        <div className="ticket-modal-overlay" onMouseDown={event => {
          if (event.target === event.currentTarget && !updatingTicket) setSelectedTicket(null);
        }}>
          <div className="ticket-modal">
            <div className="ticket-modal-heading">
              <div>
                <span className="eyebrow">TICKET MANAGEMENT</span>
                <h2>Manage support ticket</h2>
                <p>Update ownership, progress and resolution details.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedTicket(null)}
                disabled={updatingTicket}
              >×</button>
            </div>

            <div className="ticket-message">
              <strong>{selectedTicket.title}</strong>
              <p>{selectedTicket.description}</p>
              <small>Reference: CD-{selectedTicket.id.slice(0, 8).toUpperCase()}</small>
            </div>

            <form onSubmit={handleUpdateTicket}>
              <label htmlFor="ticket-assigned-to">Assign to</label>
              <input
                id="ticket-assigned-to"
                value={assignedTo}
                onChange={event => setAssignedTo(event.target.value)}
                placeholder="Technician name or email"
              />

              <label htmlFor="ticket-status">Status</label>
              <select
                id="ticket-status"
                value={ticketStatus}
                onChange={event => setTicketStatus(event.target.value as TicketStatus)}
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING">Pending</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>

              <label htmlFor="ticket-resolution-notes">Resolution notes</label>
              <textarea
                id="ticket-resolution-notes"
                value={resolutionNotes}
                onChange={event => setResolutionNotes(event.target.value)}
                placeholder="Record troubleshooting steps, findings and resolution..."
                rows={4}
              />

              {error && <div className="ticket-message error-message">{error}</div>}

              <div className="ticket-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSelectedTicket(null)}
                  disabled={updatingTicket}
                >Cancel</button>
                <button type="submit" className="primary-button" disabled={updatingTicket}>
                  {updatingTicket ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <div className="ticket-modal-overlay" onMouseDown={event => {
          if (event.target === event.currentTarget) setShowForm(false);
        }}>
          <div className="ticket-modal">
            <div className="ticket-modal-heading">
              <div>
                <span className="eyebrow">IT SUPPORT</span>
                <h2>Create a support ticket</h2>
                <p>Describe the issue and our team can investigate.</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>

            <form onSubmit={handleCreateTicket}>
              <label htmlFor="ticket-title">Issue title</label>
              <input
                id="ticket-title"
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="e.g. Laptop cannot connect to Wi-Fi"
                maxLength={120}
                required
              />

              <label htmlFor="ticket-description">Describe the issue</label>
              <textarea
                id="ticket-description"
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder="Explain what happened, when it started and any error messages..."
                rows={5}
                required
              />

              <div className="ticket-form-row">
                <div>
                  <label htmlFor="ticket-category">Category</label>
                  <select id="ticket-category" value={category}
                    onChange={event => setCategory(event.target.value as TicketCategory)}>
                    <option value="HARDWARE">Hardware</option>
                    <option value="SOFTWARE">Software</option>
                    <option value="NETWORK">Network</option>
                    <option value="ACCESS">Access</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ticket-priority">Priority</label>
                  <select id="ticket-priority" value={priority}
                    onChange={event => setPriority(event.target.value as TicketPriority)}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              {error && <div className="ticket-message error-message">{error}</div>}

              <div className="ticket-form-actions">
                <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <Dashboard signOut={signOut} user={user} />
      )}
    </Authenticator>
  );
}

export default App;
