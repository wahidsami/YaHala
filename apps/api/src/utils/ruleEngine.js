/**
 * Server-side Rule Engine
 * Evaluates widget visibility rules based on context
 */

const CONDITION_EVALUATORS = {
    // Time conditions
    'time.before_event_start': (ctx) => ctx.time?.state === 'before_event',
    'time.during_event': (ctx) => ctx.time?.state === 'during_event',
    'time.after_event_end': (ctx) => ctx.time?.state === 'after_event',

    // Scan conditions
    'scan.checked_in': (ctx) => ctx.scan?.status === 'checked_in',
    'scan.not_scanned': (ctx) => ctx.scan?.status === 'not_scanned',

    // Event conditions
    'event.type_is': (ctx, value) => ctx.event?.type === value,

    // Guest conditions
    'guest.group_is': (ctx, value) => ctx.guest?.group === value,
    'guest.has_companions': (ctx) => ctx.guest?.hasCompanions === true
};

/**
 * Evaluate a single condition
 */
function evaluateCondition(condition, context) {
    const key = `${condition.type}.${condition.operator}`;
    const evaluator = CONDITION_EVALUATORS[key];

    if (!evaluator) {
        // If no specific evaluator, try generic evaluation
        if (condition.type === 'event' && condition.operator === 'type_is') {
            return context.event?.type === condition.value;
        }
        if (condition.type === 'guest' && condition.operator === 'group_is') {
            return context.guest?.group === condition.value;
        }
        return true; // Unknown condition = pass
    }

    return evaluator(context, condition.value);
}

/**
 * Evaluate all rules for a widget
 * Returns { visible: boolean, reason: string }
 */
export function evaluateRules(widget, context) {
    const rules = widget.rules || [];

    // No rules = always visible
    if (rules.length === 0) {
        return { visible: true, reason: 'No rules (always visible)' };
    }

    // Default visibility is show unless a rule changes it
    let visible = true;
    let appliedRule = null;

    for (const rule of rules) {
        const conditions = rule.conditions || [];
        if (conditions.length === 0) continue;

        // Evaluate all conditions
        const results = conditions.map(c => evaluateCondition(c, context));

        // Apply logic (AND/OR)
        let conditionsMet;
        if (rule.conditionLogic === 'or') {
            conditionsMet = results.some(r => r === true);
        } else {
            // Default to AND
            conditionsMet = results.every(r => r === true);
        }

        if (conditionsMet) {
            // Apply action
            if (rule.action === 'hide') {
                visible = false;
                appliedRule = rule;
                break; // First matching rule wins
            } else if (rule.action === 'show') {
                visible = true;
                appliedRule = rule;
                break;
            }
        }
    }

    // Build reason string
    let reason;
    if (appliedRule) {
        const conditionDescriptions = appliedRule.conditions.map(c =>
            `${c.type}.${c.operator}${c.value ? `(${c.value})` : ''}`
        ).join(appliedRule.conditionLogic === 'or' ? ' OR ' : ' AND ');
        reason = `${appliedRule.action.toUpperCase()}: ${conditionDescriptions}`;
    } else {
        reason = 'No matching rules (default visible)';
    }

    return { visible, reason };
}

/**
 * Get condition type options for UI
 */
export function getConditionTypes() {
    return [
        { type: 'time', label: 'Time', operators: ['before_event_start', 'during_event', 'after_event_end'] },
        { type: 'scan', label: 'Scan Status', operators: ['checked_in', 'not_scanned'] },
        { type: 'event', label: 'Event', operators: ['type_is'] },
        { type: 'guest', label: 'Guest', operators: ['group_is', 'has_companions'] }
    ];
}
