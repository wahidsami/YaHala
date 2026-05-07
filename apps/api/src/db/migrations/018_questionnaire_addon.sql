-- Questionnaire addon foundation (V1)

CREATE TABLE IF NOT EXISTS questionnaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    title_ar VARCHAR(180),
    description TEXT,
    description_ar TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    start_date TIMESTAMP NULL,
    end_date TIMESTAMP NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES dashboard_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_questionnaires_client
    ON questionnaires(client_id);

CREATE INDEX IF NOT EXISTS idx_questionnaires_event
    ON questionnaires(event_id);

CREATE INDEX IF NOT EXISTS idx_questionnaires_status
    ON questionnaires(status);

CREATE TABLE IF NOT EXISTS questionnaire_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    question_type VARCHAR(40) NOT NULL
        CHECK (question_type IN ('yes_no', 'single_choice', 'multiple_choice', 'short_text', 'rating')),
    title VARCHAR(220) NOT NULL,
    title_ar VARCHAR(220),
    description TEXT,
    description_ar TEXT,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_questions_questionnaire
    ON questionnaire_questions(questionnaire_id, sort_order);

CREATE TABLE IF NOT EXISTS questionnaire_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questionnaire_questions(id) ON DELETE CASCADE,
    label VARCHAR(220) NOT NULL,
    label_ar VARCHAR(220),
    value VARCHAR(120) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_options_question
    ON questionnaire_options(question_id, sort_order);

CREATE TABLE IF NOT EXISTS questionnaire_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    project_id UUID REFERENCES invitation_projects(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES invitation_recipients(id) ON DELETE SET NULL,
    client_guest_id UUID REFERENCES client_guests(id) ON DELETE SET NULL,
    session_id VARCHAR(128),
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CHECK (recipient_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_submissions_questionnaire
    ON questionnaire_submissions(questionnaire_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_questionnaire_submissions_event
    ON questionnaire_submissions(event_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_questionnaire_submissions_guest
    ON questionnaire_submissions(client_guest_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_questionnaire_submission_recipient
    ON questionnaire_submissions(questionnaire_id, recipient_id)
    WHERE recipient_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_questionnaire_submission_session
    ON questionnaire_submissions(questionnaire_id, session_id)
    WHERE recipient_id IS NULL AND session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS questionnaire_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES questionnaire_submissions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questionnaire_questions(id) ON DELETE CASCADE,
    option_id UUID REFERENCES questionnaire_options(id) ON DELETE SET NULL,
    answer_text TEXT,
    answer_number NUMERIC(12, 2),
    answer_boolean BOOLEAN,
    answer_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_answers_submission
    ON questionnaire_answers(submission_id);

CREATE INDEX IF NOT EXISTS idx_questionnaire_answers_question
    ON questionnaire_answers(question_id);
