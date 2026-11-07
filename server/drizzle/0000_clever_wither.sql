CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_id` text NOT NULL,
	`subject` text NOT NULL,
	`status` text NOT NULL,
	`discoverable` integer DEFAULT false NOT NULL,
	`doc` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `courses_learner_idx` ON `courses` (`learner_id`);--> statement-breakpoint
CREATE INDEX `courses_discoverable_idx` ON `courses` (`discoverable`);--> statement-breakpoint
CREATE TABLE `history_events` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_id` text NOT NULL,
	`type` text NOT NULL,
	`course_id` text,
	`lesson_id` text,
	`at` text NOT NULL,
	`doc` text NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `history_learner_at_idx` ON `history_events` (`learner_id`,`at`);--> statement-breakpoint
CREATE INDEX `history_lesson_idx` ON `history_events` (`learner_id`,`lesson_id`);--> statement-breakpoint
CREATE TABLE `intake_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_id` text NOT NULL,
	`course_id` text,
	`status` text NOT NULL,
	`transcript` text NOT NULL,
	`context` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `intake_learner_idx` ON `intake_sessions` (`learner_id`);--> statement-breakpoint
CREATE TABLE `learners` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`display_name` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learners_token_unique` ON `learners` (`token`);--> statement-breakpoint
CREATE TABLE `learning_experiences` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`learner_id` text NOT NULL,
	`course_id` text NOT NULL,
	`doc` text NOT NULL,
	`generated_at` text NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `experiences_lookup_idx` ON `learning_experiences` (`learner_id`,`course_id`,`lesson_id`);--> statement-breakpoint
CREATE TABLE `lesson_completions` (
	`learner_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`lesson_content_version` integer NOT NULL,
	`course_id` text NOT NULL,
	`experience_id` text NOT NULL,
	`completed_at` text NOT NULL,
	PRIMARY KEY(`learner_id`, `lesson_id`),
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`objective` text NOT NULL,
	`content_version` integer NOT NULL,
	`doc` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lessons_subject_idx` ON `lessons` (`subject`);--> statement-breakpoint
CREATE TABLE `skill_trees` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`doc` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `skill_trees_course_idx` ON `skill_trees` (`course_id`);--> statement-breakpoint
CREATE TABLE `streaks` (
	`learner_id` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`last_active_date` text,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE no action
);
