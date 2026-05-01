-- PostgreSQL Submissions Schema

-- Guests table
CREATE TABLE IF NOT EXISTS guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  guest_group VARCHAR(20) DEFAULT 'regular' CHECK (guest_group IN ('regular', 'vip', 'family')),
  companion_count INT DEFAULT 0,
  invitation_status VARCHAR(20) DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'sent', 'delivered', 'clicked')),
  check_in_status VARCHAR(20) DEFAULT 'not_checked_in' CHECK (check_in_status IN ('not_checked_in', 'checked_in')),
  checked_in_at TIMESTAMP,
  qr_token VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_guests_event ON guests(event_id);
CREATE INDEX idx_guests_group ON guests(guest_group);
CREATE INDEX idx_guests_check_in ON guests(check_in_status);

-- Guest submissions (voice/text messages)
CREATE TABLE IF NOT EXISTS guest_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  submission_type VARCHAR(10) NOT NULL CHECK (submission_type IN ('voice', 'text')),
  content TEXT,
  file_url VARCHAR(500),
  duration_seconds INT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_submissions_event ON guest_submissions(event_id);
CREATE INDEX idx_submissions_status ON guest_submissions(status);
CREATE INDEX idx_submissions_type ON guest_submissions(submission_type);

-- Survey responses
CREATE TABLE IF NOT EXISTS guest_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  question_id UUID NOT NULL,
  question_text VARCHAR(500),
  answer_value VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_responses_event ON guest_responses(event_id);
CREATE INDEX idx_responses_question ON guest_responses(question_id);

-- Memory books
CREATE TABLE IF NOT EXISTS memory_books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  html_url VARCHAR(500),
  settings JSONB,
  generated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_memory_books_event ON memory_books(event_id);
