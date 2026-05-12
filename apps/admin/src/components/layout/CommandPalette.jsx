import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, Link2, Mail, Palette, Search, Settings, Sparkles, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './CommandPalette.css';

function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

function normalizeResults(rows, type, getPath, i18n) {
    return (rows || []).map((row) => ({
        id: `${type}-${row.id}`,
        type,
        path: getPath(row),
        title:
            row.title ||
            localize(i18n, row.name || row.display_name || row.email || row.id, row.name_ar || row.display_name_ar || row.name || row.display_name || row.email || row.id),
        subtitle: localize(
            i18n,
            row.client_name || row.event_name || row.email || '',
            row.client_name_ar || row.event_name_ar || row.client_name || row.event_name || row.email || ''
        )
    }));
}

export default function CommandPalette({ open, onClose }) {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { hasPermission } = useAuth();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [sections, setSections] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const itemRefs = useRef([]);
    const normalizedQuery = query.trim().replace(/^\/+/, '');
    const queryTerm = normalizedQuery.toLowerCase();
    const hasSearchAccess = hasPermission('events.view') || hasPermission('clients.view') || hasPermission('templates.view') || hasPermission('guests.view');

    const quickActions = useMemo(() => {
        const items = [
            {
                id: 'create-event',
                title: localize(i18n, 'Create event', 'Create event'),
                subtitle: localize(i18n, 'Start the guided event wizard', 'Start the guided event wizard'),
                path: '/events/new',
                icon: Sparkles,
                allowed: hasPermission('events.create')
            },
            {
                id: 'open-events',
                title: localize(i18n, 'Open events', 'Open events'),
                subtitle: localize(i18n, 'View all events and workspaces', 'View all events and workspaces'),
                path: '/events',
                icon: Sparkles,
                allowed: hasPermission('events.view')
            },
            {
                id: 'open-clients',
                title: localize(i18n, 'Open clients', 'Open clients'),
                subtitle: localize(i18n, 'Browse and manage all clients', 'Browse and manage all clients'),
                path: '/clients',
                icon: Users,
                allowed: hasPermission('clients.view')
            },
            {
                id: 'create-client',
                title: localize(i18n, 'Create client', 'Create client'),
                subtitle: localize(i18n, 'Add a client before creating an event', 'Add a client before creating an event'),
                path: '/clients/new',
                icon: Briefcase,
                allowed: hasPermission('clients.create')
            },
            {
                id: 'manage-guests',
                title: localize(i18n, 'Manage guests', 'Manage guests'),
                subtitle: localize(i18n, 'Browse your guest directory', 'Browse your guest directory'),
                path: '/guests',
                icon: Users,
                allowed: hasPermission('guests.view')
            },
            {
                id: 'send-invitations',
                title: localize(i18n, 'Send invitations', 'Send invitations'),
                subtitle: localize(i18n, 'Open the event send workspace', 'Open the event send workspace'),
                path: '/send',
                icon: Mail,
                allowed: hasPermission('events.view')
            },
            {
                id: 'open-templates',
                title: localize(i18n, 'Open library', 'Open library'),
                subtitle: localize(i18n, 'Browse templates, drafts, and favorites', 'Browse templates, drafts, and favorites'),
                path: '/library',
                icon: Palette,
                allowed: hasPermission('templates.view')
            },
            {
                id: 'library',
                title: localize(i18n, 'Library & templates', 'Library & templates'),
                subtitle: localize(i18n, 'Browse and reuse templates', 'Browse and reuse templates'),
                path: '/library',
                icon: Palette,
                allowed: hasPermission('templates.view')
            }
        ];

        return items.filter((item) => item.allowed);
    }, [hasPermission, i18n]);

    const powerTools = useMemo(() => {
        const items = [
            {
                id: 'reports',
                title: localize(i18n, 'Reports', 'Reports'),
                subtitle: localize(i18n, 'Operational and RSVP reporting', 'Operational and RSVP reporting'),
                path: '/reports',
                icon: Link2,
                allowed: hasPermission('reports.view')
            },
            {
                id: 'logs',
                title: localize(i18n, 'Logs', 'Logs'),
                subtitle: localize(i18n, 'Inspect operational logs and activity', 'Inspect operational logs and activity'),
                path: '/logs',
                icon: Link2,
                allowed: hasPermission('logs.view')
            },
            {
                id: 'addons',
                title: localize(i18n, 'Addons', 'Addons'),
                subtitle: localize(i18n, 'Manage polls, questionnaires, and instructions', 'Manage polls, questionnaires, and instructions'),
                path: '/addons',
                icon: Palette,
                allowed: hasPermission('addons.view')
            },
            {
                id: 'invitation-projects',
                title: localize(i18n, 'Invitation projects', 'Invitation projects'),
                subtitle: localize(i18n, 'Manage invitation project workflows', 'Manage invitation project workflows'),
                path: '/invitation-projects',
                icon: Link2,
                allowed: hasPermission('events.view')
            },
            {
                id: 'settings',
                title: localize(i18n, 'Settings', 'Settings'),
                subtitle: localize(i18n, 'Delivery and system configuration', 'Delivery and system configuration'),
                path: '/settings',
                icon: Settings,
                allowed: hasPermission('settings.view')
            }
        ];

        return items.filter((item) => item.allowed);
    }, [hasPermission, i18n]);

    const matchingQuickActions = useMemo(() => {
        if (!queryTerm) {
            return quickActions;
        }

        return quickActions.filter((item) => (
            [item.title, item.subtitle, item.path]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(queryTerm))
        ));
    }, [queryTerm, quickActions]);

    const matchingPowerTools = useMemo(() => {
        if (!queryTerm) {
            return powerTools;
        }

        return powerTools.filter((item) => (
            [item.title, item.subtitle, item.path]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(queryTerm))
        ));
    }, [queryTerm, powerTools]);

    useEffect(() => {
        if (!open) {
            setQuery('');
            setSections([]);
            setLoading(false);
            setActiveIndex(0);
        }
    }, [open]);

    useEffect(() => {
        setActiveIndex(0);
    }, [normalizedQuery]);

    useEffect(() => {
        if (!open || normalizedQuery.length < 2) {
            setSections([]);
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setLoading(true);

            const jobs = [];
            if (hasPermission('events.view')) {
                jobs.push(api.get(`/admin/events?page=1&pageSize=5&search=${encodeURIComponent(normalizedQuery)}`));
            } else {
                jobs.push(Promise.resolve({ data: { data: [] } }));
            }
            if (hasPermission('clients.view')) {
                jobs.push(api.get(`/admin/clients?page=1&pageSize=5&search=${encodeURIComponent(normalizedQuery)}`));
            } else {
                jobs.push(Promise.resolve({ data: { data: [] } }));
            }
            if (hasPermission('templates.view')) {
                jobs.push(api.get(`/admin/templates?page=1&pageSize=5&search=${encodeURIComponent(normalizedQuery)}`));
            } else {
                jobs.push(Promise.resolve({ data: { data: [] } }));
            }
            if (hasPermission('guests.view')) {
                jobs.push(api.get(`/admin/guests?page=1&pageSize=5&search=${encodeURIComponent(normalizedQuery)}`));
            } else {
                jobs.push(Promise.resolve({ data: { data: [] } }));
            }
            if (hasPermission('events.view')) {
                jobs.push(api.get(`/admin/invitation-projects?page=1&pageSize=5&search=${encodeURIComponent(normalizedQuery)}`));
            } else {
                jobs.push(Promise.resolve({ data: { data: [] } }));
            }

            const settled = await Promise.allSettled(jobs);
            if (cancelled) {
                return;
            }

            const [eventsRes, clientsRes, templatesRes, guestsRes, projectsRes] = settled.map((result) => (
                result.status === 'fulfilled' ? result.value.data?.data || [] : []
            ));

            const nextSections = [
                {
                    label: localize(i18n, 'Events', 'Events'),
                    items: normalizeResults(eventsRes, 'event', (row) => `/events/${row.id}`, i18n)
                },
                {
                    label: localize(i18n, 'Clients', 'Clients'),
                    items: normalizeResults(clientsRes, 'client', (row) => `/clients/${row.id}`, i18n)
                },
                {
                    label: localize(i18n, 'Templates', 'Templates'),
                    items: normalizeResults(templatesRes, 'template', (row) => `/templates/${row.id}`, i18n)
                },
                {
                    label: localize(i18n, 'Guests', 'Guests'),
                    items: normalizeResults(guestsRes, 'guest', (row) => `/clients/${row.client_id}?tab=guests`, i18n)
                },
                {
                    label: localize(i18n, 'Invitation projects', 'Invitation projects'),
                    items: normalizeResults(projectsRes, 'project', (row) => `/invitation-projects/${row.id}`, i18n)
                }
            ].filter((section) => section.items.length > 0);

            setSections(nextSections);
            setLoading(false);
        }, 220);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [hasPermission, i18n, normalizedQuery, open]);

    const commandItems = matchingQuickActions.map((item) => ({ ...item, group: 'commands' }));
    const powerToolItems = matchingPowerTools.map((item) => ({ ...item, group: 'power' }));
    const searchResultItems = sections.flatMap((section) => (
        section.items.map((item) => ({ ...item, group: `section-${section.label}` }))
    ));

    const visibleItems = normalizedQuery.length < 2
        ? [...commandItems, ...powerToolItems]
        : [...commandItems, ...powerToolItems, ...searchResultItems];

    const boundedActiveIndex = visibleItems.length === 0 ? -1 : Math.min(activeIndex, visibleItems.length - 1);

    function setItemRef(index, node) {
        itemRefs.current[index] = node;
    }

    function onItemFocus(index) {
        setActiveIndex(index);
    }

    const moveActiveIndex = useCallback((direction) => {
        if (!visibleItems.length) {
            return;
        }
        const current = boundedActiveIndex === -1 ? 0 : boundedActiveIndex;
        const next = (current + direction + visibleItems.length) % visibleItems.length;
        setActiveIndex(next);
        const node = itemRefs.current[next];
        if (node) {
            node.focus();
            node.scrollIntoView({ block: 'nearest' });
        }
    }, [boundedActiveIndex, visibleItems]);

    const handleKeyDown = useCallback((event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveActiveIndex(1);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveActiveIndex(-1);
            return;
        }
        if (event.key === 'Enter') {
            if (boundedActiveIndex < 0) {
                return;
            }
            event.preventDefault();
            handleNavigate(visibleItems[boundedActiveIndex].path);
        }
    }, [boundedActiveIndex, moveActiveIndex, onClose, visibleItems]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        function onWindowKeyDown(event) {
            if (event.defaultPrevented || event.isComposing) {
                return;
            }
            if (event.key === 'Escape' || event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
                handleKeyDown(event);
            }
        }

        window.addEventListener('keydown', onWindowKeyDown);
        return () => window.removeEventListener('keydown', onWindowKeyDown);
    }, [handleKeyDown, open]);

    function handleNavigate(path) {
        navigate(path);
        onClose();
    }

    if (!open) {
        return null;
    }

    return (
        <div className="command-palette-backdrop" role="presentation" onClick={onClose}>
            <div className="command-palette" role="dialog" aria-modal="true" aria-label={localize(i18n, 'Search the admin workspace', 'Search the admin workspace')} onClick={(event) => event.stopPropagation()} onKeyDown={handleKeyDown}>
                <div className="command-palette__search">
                    <Search size={18} />
                    <input
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={localize(i18n, 'Search events, clients, guests, templates...', 'Search events, clients, guests, templates...')}
                        autoFocus
                    />
                    <span className="command-palette__hint">Esc</span>
                </div>

                {normalizedQuery.length < 2 ? (
                    <div className="command-palette__quick-actions">
                        <div className="command-palette__section-title">{localize(i18n, 'Quick actions', 'Quick actions')}</div>
                        {matchingQuickActions.map((item, index) => {
                            const Icon = item.icon;
                            const itemIndex = index;
                            return (
                                <button key={item.id} type="button" className={`command-palette__item ${itemIndex === boundedActiveIndex ? 'is-active' : ''}`} onClick={() => handleNavigate(item.path)} onFocus={() => onItemFocus(itemIndex)} ref={(node) => setItemRef(itemIndex, node)}>
                                    <span className="command-palette__icon">
                                        <Icon size={16} />
                                    </span>
                                    <span>
                                        <strong>{item.title}</strong>
                                        <small>{item.subtitle}</small>
                                    </span>
                                </button>
                            );
                        })}

                        {matchingPowerTools.length > 0 && (
                            <>
                                <div className="command-palette__section-title">{localize(i18n, 'Power tools', 'Power tools')}</div>
                                {matchingPowerTools.map((item, index) => {
                                    const Icon = item.icon;
                                    const itemIndex = matchingQuickActions.length + index;
                                    return (
                                        <button key={item.id} type="button" className={`command-palette__item ${itemIndex === boundedActiveIndex ? 'is-active' : ''}`} onClick={() => handleNavigate(item.path)} onFocus={() => onItemFocus(itemIndex)} ref={(node) => setItemRef(itemIndex, node)}>
                                            <span className="command-palette__icon">
                                                <Icon size={16} />
                                            </span>
                                            <span>
                                                <strong>{item.title}</strong>
                                                <small>{item.subtitle}</small>
                                            </span>
                                        </button>
                                    );
                                })}
                            </>
                        )}
                    </div>
                ) : loading ? (
                    <div className="command-palette__empty">{t('common.loading')}</div>
                ) : sections.length === 0 && normalizedQuery.length >= 2 && !hasSearchAccess ? (
                    <div className="command-palette__empty">{localize(i18n, 'No searchable resources are available for your role.', 'No searchable resources are available for your role.')}</div>
                ) : sections.length === 0 && matchingQuickActions.length === 0 && matchingPowerTools.length === 0 ? (
                    <div className="command-palette__empty">{localize(i18n, 'No matching results', 'No matching results')}</div>
                ) : (
                    <div className="command-palette__results">
                        {matchingQuickActions.length > 0 && (
                            <div className="command-palette__section">
                                <div className="command-palette__section-title">{localize(i18n, 'Commands', 'Commands')}</div>
                                {matchingQuickActions.map((item, index) => {
                                    const Icon = item.icon;
                                    const itemIndex = index;
                                    return (
                                        <button key={item.id} type="button" className={`command-palette__item ${itemIndex === boundedActiveIndex ? 'is-active' : ''}`} onClick={() => handleNavigate(item.path)} onFocus={() => onItemFocus(itemIndex)} ref={(node) => setItemRef(itemIndex, node)}>
                                            <span className="command-palette__icon">
                                                <Icon size={16} />
                                            </span>
                                            <span>
                                                <strong>{item.title}</strong>
                                                <small>{item.subtitle}</small>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {matchingPowerTools.length > 0 && (
                            <div className="command-palette__section">
                                <div className="command-palette__section-title">{localize(i18n, 'Power tools', 'Power tools')}</div>
                                {matchingPowerTools.map((item, index) => {
                                    const Icon = item.icon;
                                    const itemIndex = matchingQuickActions.length + index;
                                    return (
                                        <button key={item.id} type="button" className={`command-palette__item ${itemIndex === boundedActiveIndex ? 'is-active' : ''}`} onClick={() => handleNavigate(item.path)} onFocus={() => onItemFocus(itemIndex)} ref={(node) => setItemRef(itemIndex, node)}>
                                            <span className="command-palette__icon">
                                                <Icon size={16} />
                                            </span>
                                            <span>
                                                <strong>{item.title}</strong>
                                                <small>{item.subtitle}</small>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {sections.map((section, sectionIndex) => (
                            <div key={section.label} className="command-palette__section">
                                <div className="command-palette__section-title">{section.label}</div>
                                {section.items.map((item, index) => {
                                    const sectionOffset = matchingQuickActions.length + matchingPowerTools.length + sections
                                        .slice(0, sectionIndex)
                                        .reduce((sum, candidate) => sum + candidate.items.length, 0);
                                    const itemIndex = sectionOffset + index;
                                    return (
                                        <button key={item.id} type="button" className={`command-palette__item ${itemIndex === boundedActiveIndex ? 'is-active' : ''}`} onClick={() => handleNavigate(item.path)} onFocus={() => onItemFocus(itemIndex)} ref={(node) => setItemRef(itemIndex, node)}>
                                            <span className="command-palette__icon">
                                                {item.type === 'event' && <Sparkles size={16} />}
                                                {item.type === 'client' && <Users size={16} />}
                                                {item.type === 'template' && <Palette size={16} />}
                                                {item.type === 'guest' && <Mail size={16} />}
                                                {item.type === 'project' && <Link2 size={16} />}
                                            </span>
                                            <span>
                                                <strong>{item.title}</strong>
                                                <small>{item.subtitle || localize(i18n, 'Open detail', 'Open detail')}</small>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ))}

                        {sections.length === 0 && normalizedQuery.length >= 2 && hasSearchAccess && (
                            <div className="command-palette__empty">{localize(i18n, 'No matching records in searchable resources.', 'No matching records in searchable resources.')}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
