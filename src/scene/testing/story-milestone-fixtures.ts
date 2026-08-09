import {
  createStoryMilestoneSession,
  storyMilestoneView,
  type StoryMilestoneId,
  type StoryMilestoneView,
} from '../story/milestone-model'

export function buildStoryMilestoneFixture(id: StoryMilestoneId): StoryMilestoneView {
  return storyMilestoneView(createStoryMilestoneSession(id))
}
