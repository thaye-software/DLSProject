-- Insert a default country
INSERT INTO countries (name, abbreviation, currency)
VALUES ('Denmark', 'DK', 'DKK')
RETURNING id;

-- Let's assume the returned country id is 1

-- Insert addresses for the users
INSERT INTO addresses (user_id, address_line_1, address_line_2, city, zip_code, state_province)
VALUES 
(1, '123 Main St', '', 'Copenhagen', '1000', ''),
(2, '456 Elm St', 'Apt 2', 'Aarhus', '8000', '')
RETURNING id;

-- Assume returned address ids are 1 and 2

-- Insert two default users
INSERT INTO users (username, email, password, avatar_url, email_confirmed, country, address)
VALUES
('alice', 'alice@example.com', 'hashed_password_1', NULL, TRUE, 1, 1),
('bob', 'bob@example.com', 'hashed_password_2', NULL, TRUE, 1, 2);
