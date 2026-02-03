
-- Database Schema for SIMPDB (Sistem Informasi Manajemen Penjadwalan Kuliah)

CREATE TABLE IF NOT EXISTS `courses` (
  `id` VARCHAR(50) PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `credits` INT DEFAULT 0,
  `coordinatorId` VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS `lecturers` (
  `id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `nip` VARCHAR(50),
  `position` VARCHAR(100),
  `expertise` TEXT,
  `username` VARCHAR(100),
  `password` VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS `rooms` (
  `id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `capacity` INT DEFAULT 0,
  `building` VARCHAR(100),
  `location` TEXT
);

CREATE TABLE IF NOT EXISTS `classes` (
  `id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS `schedule` (
  `id` VARCHAR(50) PRIMARY KEY,
  `courseId` VARCHAR(50),
  `lecturerIds` TEXT, -- JSON array of strings
  `pjmkLecturerId` VARCHAR(50),
  `roomId` VARCHAR(50),
  `className` VARCHAR(50),
  `day` VARCHAR(20),
  `timeSlot` VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS `teaching_logs` (
  `id` VARCHAR(50) PRIMARY KEY,
  `scheduleId` VARCHAR(50),
  `lecturerId` VARCHAR(50),
  `week` INT,
  `timestamp` DATETIME,
  `date` DATE
);

CREATE TABLE IF NOT EXISTS `settings` (
  `id` VARCHAR(50) PRIMARY KEY,
  `key` VARCHAR(100) UNIQUE,
  `value` TEXT
);

-- Insert Default Classes (PDB01 - PDB125)
-- (Ideally generated via script, but schema is here)
