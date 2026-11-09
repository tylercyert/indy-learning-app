# Poko: Learn Anything

An adaptive learning platform: a learner says what they want to learn, a conversation gathers context, and the platform generates a personalized course they progress through as a skill tree of reusable lessons. Content is generated on demand and validated before it is shown; progress and learning evidence persist across courses.

## Language

### Learning structure

**Course**:
The overall learning journey toward one topic or objective. A course can contain several skill trees over time; it is completed when the required lessons of its current skill tree are completed, and continuing adds a new skill tree and reopens it.
_Avoid_: Path, journey, adventure, track

**Skill Tree**:
A structured, visual learning path within a course. It defines nodes, connections, progression rules, optional branches and unlocking. A course's first skill tree is its foundation; later ones add depth.
_Avoid_: Map, curriculum, path (in code; "tree" alone is an acceptable code abbreviation)

**Node**:
A lesson's placement in one specific skill tree: its position, progression rule, and whether it is required or optional. The same lesson appears in many skill trees through different nodes.
_Avoid_: Step, stage, module

**Lesson**:
A reusable unit of learning with one learning objective. A lesson has a stable identity independent of any course and can appear in many skill trees.
_Avoid_: Topic, unit, chapter

**Learning Objective**:
The specific capability a lesson exists to teach, stated in plain language. It is what makes two lessons comparable for reuse.
_Avoid_: Goal (reserved for the learner's own goal), outcome

**Learning Experience**:
The instructional run of a lesson for one learner in one course: an ordered sequence of slides generated or adapted to that learner's context. One lesson can have many learning experiences.
_Avoid_: Lesson content, lesson instance

**Slide**:
One structured unit of instructional content shown to the learner, composed of components.
_Avoid_: Pane, screen, card, page

**Component**:
A reusable, contract-driven block placed on a slide. A component is presentational, interactive or assessable, and may combine those roles.
_Avoid_: Widget, block, element

**Orientation Lesson**:
The lesson at a course's single orientation node, the root of its first skill tree: it introduces the subject, establishes a baseline and helps the platform understand the learner. Orientation is a node placement, not a property of the lesson itself. It is short and preview-only: at most five slides, at most one of them teaching or practice, and a preview of the path ahead that says how many more lessons follow when it stops early.
_Avoid_: 101, intro, onboarding lesson

### Progression

**Progression Rule**:
The condition on a node that makes it available: all of, any of, or at least N of a set of other nodes. A node with no rule is a root.
_Avoid_: Prerequisite (alone), dependency, unlock condition

**Available**:
A node whose progression rule is satisfied and whose lesson is not yet completed.
_Avoid_: Unlocked, open

**Completion**:
The learner reached the end of a lesson's learning experience and met its completion requirements. Completion is the progression signal and is recognized across courses.
_Avoid_: Done, finished, passed, mastered

**Mastery**:
A broader judgment of demonstrated understanding derived from performance and history. Mastery is not a lesson status and never blocks progression.
_Avoid_: Proficiency (as a status), level

### Learner and context

**Learner**:
The person using the platform.
_Avoid_: User (in domain code), student

**Learner Goal**:
What the learner said they want to learn, in their own words, plus the outcome they want from it.
_Avoid_: Prompt, request, intent

**Intake**:
The conversation after a learner states a goal, in which the platform asks only what it needs to plan a course.
_Avoid_: Discovery (ambiguous with course discovery), onboarding, questionnaire

**Goal Screening**:
The check that decides whether a learner goal may become a course at all: refused when the course would mainly teach something illegal, against Anthropic's usage policy, or unacceptable under app-store content rules. Runs on the stated goal before intake and again on the completed learner context before planning. A refusal is spoken by the companion and never stored as a course.
_Avoid_: moderation (implies reviewing learner speech), filter, ban

**Learner Context**:
The structured, validated record of a learner's goal, existing knowledge, constraints and preferences, produced by intake and updated by learning history. Self-reported; never evidence of mastery on its own.
_Avoid_: Preferences, profile, context payload

**Learning History**:
The learner's accumulated evidence across courses: completed lessons, slides seen, assessment results, difficulties and approaches that worked.
_Avoid_: Progress (reserved for one course), activity log

**Course Discovery**:
Browsing courses that already exist on the platform and choosing one, as opposed to creating one through intake.
_Avoid_: Catalog, explore, library

**Exploration Request**:
A learner's request, from inside a course, to learn something different, deeper or more specific. It goes through intake and changes the course without erasing progress.
_Avoid_: Deviation, detour, custom branch

### Generation

**Course Plan**:
The generated structure of a course: its skill tree, each node's learning objective, and which lessons are reused versus new. Planning is separate from generating learning experiences.
_Avoid_: Outline, syllabus, curriculum

**Generation Context**:
The assembled, task-specific subset of learner context, learning history and course plan sent with one generation request.
_Avoid_: Prompt, payload, memory

### Motivation

**Companion**:
The learner's themed character for a course: a fixed base body with a generated name and costume. Learners can rename and re-roll it.
_Avoid_: Mascot, avatar, pet

**Streak**:
Consecutive days on which the learner completed at least one lesson, counted once per learner across all courses. Viewing slides or answering without completing does not count.
_Avoid_: Chain, run

**Celebration**:
A brief animated acknowledgment when a learner completes a significant milestone.
_Avoid_: Reward, achievement, badge
