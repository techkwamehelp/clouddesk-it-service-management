import { fetchAuthSession } from 'aws-amplify/auth';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { client } from './amplifyClient';
import './App.css';

type TicketCategory = 'HARDWARE' | 'SOFTWARE' | 'NETWORK' | 'ACCESS' | 'OTHER';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

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

  async function handleUpdateTicket(event: React.FormEvent<HTMLFormElement>) {
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

  async function handleCreateTicket(event: React.FormEvent<HTMLFormElement>) {
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
          <a className="nav-item active" href="#overview">▦ <span>Overview</span></a>
          <a className="nav-item" href="#tickets">▤ <span>My Tickets</span></a>
          <a className="nav-item" href="#knowledge">▧ <span>Knowledge Base</span></a>
        </nav>

        <div className="nav-label management-label">MANAGEMENT</div>
        <nav>
          <a className="nav-item" href="#team">♙ <span>Technician Team</span></a>
          <a className="nav-item" href="#reports">▥ <span>Reports</span></a>
          <a className="nav-item" href="#settings">⚙ <span>Settings</span></a>
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
          <div className="breadcrumb">Workspace / <strong>Overview</strong></div>
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

          <section className="tickets-section" id="tickets">
            <div className="section-heading">
              <div>
                <h2>Recent support tickets</h2>
                <p>Track the latest IT requests.</p>
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

          <div className="bottom-grid">
            <div className="info-card" id="knowledge">
              <span className="info-icon">▧</span>
              <div>
                <h3>Knowledge Base</h3>
                <p>Find troubleshooting guides and answers to common IT issues.</p>
                <a href="#knowledge">Explore resources →</a>
              </div>
            </div>
            <div className="info-card" id="team">
              <span className="info-icon">♙</span>
              <div>
                <h3>IT Support Team</h3>
                <p>Get assistance with hardware, software and network issues.</p>
                <a href="#tickets">Contact support →</a>
              </div>
            </div>
          </div>

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
