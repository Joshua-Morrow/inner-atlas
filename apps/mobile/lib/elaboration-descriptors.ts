export interface DescriptorCategory {
  name: string
  words: string[]
}

export interface DescriptorSection {
  id: string
  label: string
  categories: DescriptorCategory[]
}

export const ELABORATION_SECTIONS: DescriptorSection[] = [
  {
    id: 'emotions',
    label: 'Emotions & Feelings',
    categories: [
      {
        name: 'Fear-Based',
        words: [
          'Afraid', 'Terrified', 'Anxious', 'Worried', 'Panicked', 'Nervous', 'Alarmed',
          'Apprehensive', 'Dread', 'Horrified', 'Intimidated', 'Scared', 'Threatened',
          'Vulnerable', 'Insecure', 'Overwhelmed',
        ],
      },
      {
        name: 'Anger-Based',
        words: [
          'Angry', 'Furious', 'Enraged', 'Irritated', 'Annoyed', 'Frustrated', 'Resentful',
          'Bitter', 'Hostile', 'Indignant', 'Outraged', 'Livid', 'Irate', 'Agitated',
          'Defensive', 'Vengeful',
        ],
      },
      {
        name: 'Sadness-Based',
        words: [
          'Sad', 'Depressed', 'Grief-stricken', 'Heartbroken', 'Despairing', 'Hopeless',
          'Melancholy', 'Gloomy', 'Miserable', 'Devastated', 'Mournful', 'Sorrowful',
          'Dejected', 'Disappointed', 'Discouraged', 'Defeated',
        ],
      },
      {
        name: 'Shame-Based',
        words: [
          'Ashamed', 'Guilty', 'Embarrassed', 'Humiliated', 'Mortified', 'Worthless',
          'Inadequate', 'Defective', 'Flawed', 'Dirty', 'Exposed', 'Unworthy', 'Inferior',
          'Disgusted (with self)', 'Degraded', 'Contemptible',
        ],
      },
      {
        name: 'Loneliness/Abandonment',
        words: [
          'Lonely', 'Abandoned', 'Rejected', 'Isolated', 'Alienated', 'Excluded', 'Unwanted',
          'Unloved', 'Invisible', 'Disconnected', 'Neglected', 'Forgotten', 'Left out', 'Alone',
        ],
      },
      {
        name: 'Exhaustion/Depletion',
        words: [
          'Exhausted', 'Depleted', 'Drained', 'Overwhelmed', 'Burned out', 'Weary', 'Fatigued',
          'Tired', 'Worn down', 'Spent', 'Empty', 'Numb', 'Apathetic', 'Detached', 'Resigned',
        ],
      },
      {
        name: 'Disgust/Revulsion',
        words: [
          'Disgusted', 'Revolted', 'Repulsed', 'Sickened', 'Nauseated', 'Disturbed', 'Appalled',
        ],
      },
      {
        name: 'Confusion/Disorientation',
        words: [
          'Confused', 'Bewildered', 'Lost', 'Disoriented', 'Perplexed', 'Uncertain', 'Doubtful',
          'Ambivalent', 'Torn', 'Conflicted',
        ],
      },
      {
        name: 'Powerlessness',
        words: [
          'Helpless', 'Powerless', 'Trapped', 'Stuck', 'Paralyzed', 'Frozen', 'Controlled',
          'Dominated', 'Victimized', 'Weak',
        ],
      },
      {
        name: 'Hurt/Pain',
        words: [
          'Hurt', 'Wounded', 'Betrayed', 'Crushed', 'Suffering', 'Anguished', 'Tormented',
          'Pained', 'Aching',
        ],
      },
      {
        name: 'Protective Stances',
        words: [
          'Suspicious', 'Distrustful', 'Guarded', 'Cautious', 'Skeptical', 'Cynical',
          'Hardened', 'Cold', 'Distant', 'Wary',
        ],
      },
      {
        name: 'Joy-Based',
        words: [
          'Happy', 'Joyful', 'Delighted', 'Cheerful', 'Pleased', 'Content', 'Satisfied',
          'Elated', 'Ecstatic', 'Thrilled', 'Excited', 'Exhilarated', 'Euphoric', 'Blissful',
          'Jubilant', 'Gleeful',
        ],
      },
      {
        name: 'Love/Connection',
        words: [
          'Loving', 'Loved', 'Affectionate', 'Tender', 'Caring', 'Warm', 'Connected', 'Bonded',
          'Attached', 'Appreciated', 'Cherished', 'Adored', 'Valued', 'Accepted', 'Belonging',
          'Included',
        ],
      },
      {
        name: 'Peace/Calm',
        words: [
          'Peaceful', 'Calm', 'Relaxed', 'Serene', 'Tranquil', 'At ease', 'Comfortable', 'Safe',
          'Secure', 'Protected', 'Grounded', 'Centered', 'Settled', 'Rested',
        ],
      },
      {
        name: 'Confidence/Empowerment',
        words: [
          'Confident', 'Capable', 'Competent', 'Strong', 'Powerful', 'Empowered', 'Proud',
          'Accomplished', 'Successful', 'Effective', 'Brave', 'Courageous', 'Bold', 'Determined',
          'Resilient',
        ],
      },
      {
        name: 'Interest/Engagement',
        words: [
          'Curious', 'Interested', 'Engaged', 'Fascinated', 'Intrigued', 'Absorbed', 'Captivated',
          'Stimulated', 'Inspired', 'Motivated', 'Enthusiastic', 'Passionate', 'Energized',
          'Alive', 'Vibrant',
        ],
      },
      {
        name: 'Gratitude/Appreciation',
        words: [
          'Grateful', 'Thankful', 'Appreciative', 'Blessed', 'Fortunate', 'Lucky',
        ],
      },
      {
        name: 'Hope/Optimism',
        words: [
          'Hopeful', 'Optimistic', 'Encouraged', 'Positive', 'Expectant', 'Anticipatory',
        ],
      },
      {
        name: 'Relief',
        words: [
          'Relieved', 'Unburdened', 'Lighter', 'Free', 'Released', 'Liberated',
        ],
      },
      {
        name: 'Playfulness',
        words: [
          'Playful', 'Silly', 'Goofy', 'Amused', 'Entertained', 'Lighthearted', 'Mischievous',
          'Fun-loving',
        ],
      },
      {
        name: 'Bittersweet',
        words: [
          'Nostalgic', 'Wistful', 'Poignant', 'Tender sadness', 'Grateful grief',
        ],
      },
      {
        name: 'Protective Pride',
        words: [
          'Proud (of protection provided)', 'Satisfied (job well done)', 'Vigilant', 'Dutiful',
          'Responsible',
        ],
      },
      {
        name: 'Yearning',
        words: [
          'Longing', 'Aching (for something)', 'Wishing', 'Wanting', 'Craving',
          'Hungry (emotionally)',
        ],
      },
      {
        name: 'Somatic/Body-Based',
        words: [
          'Heavy', 'Light', 'Tight', 'Constricted', 'Expanded', 'Buzzing', 'Vibrating', 'Hot',
          'Cold', 'Frozen', 'Fluid', 'Dense', 'Spacious', 'Pressured', 'Compressed', 'Floating',
          'Sinking', 'Spinning', 'Racing', 'Still',
        ],
      },
      {
        name: 'Numbness/Absence',
        words: [
          'Numb', 'Empty', 'Void', 'Blank', 'Shut down', 'Dissociated', 'Disconnected',
          'Absent', 'Gone', 'Nothing',
        ],
      },
    ],
  },
  {
    id: 'personality',
    label: 'Personality Qualities',
    categories: [
      {
        name: 'Intelligence & Cognition',
        words: [
          'Analytical', 'Logical', 'Rational', 'Intellectual', 'Curious', 'Perceptive',
          'Observant', 'Shrewd', 'Clever', 'Sharp', 'Thoughtful', 'Reflective', 'Philosophical',
          'Wise', 'Discerning', 'Insightful', 'Imaginative', 'Inventive', 'Creative',
        ],
      },
      {
        name: 'Organization & Structure',
        words: [
          'Organized', 'Structured', 'Methodical', 'Systematic', 'Orderly', 'Precise', 'Exact',
          'Meticulous', 'Thorough', 'Detail-oriented', 'Punctual', 'Efficient', 'Disciplined',
          'Focused', 'Deliberate', 'Careful',
        ],
      },
      {
        name: 'Energy & Drive',
        words: [
          'Energetic', 'Ambitious', 'Driven', 'Motivated', 'Determined', 'Persistent',
          'Tenacious', 'Relentless', 'Purposeful', 'Goal-oriented', 'Spirited', 'Vigorous',
          'Forceful', 'Unstoppable', 'Active',
        ],
      },
      {
        name: 'Social Orientation',
        words: [
          'Extroverted', 'Introverted', 'Gregarious', 'Sociable', 'Friendly', 'Outgoing',
          'Reserved', 'Quiet', 'Withdrawn', 'Solitary', 'Private', 'Public', 'People-oriented',
          'Lone',
        ],
      },
      {
        name: 'Warmth & Compassion',
        words: [
          'Warm', 'Compassionate', 'Empathic', 'Caring', 'Kind', 'Gentle', 'Tender', 'Loving',
          'Supportive', 'Understanding', 'Sympathetic', 'Considerate', 'Thoughtful', 'Generous',
        ],
      },
      {
        name: 'Control & Authority',
        words: [
          'Controlling', 'Dominant', 'Authoritative', 'Commanding', 'Directive', 'Assertive',
          'Decisive', 'Firm', 'Imperious', 'Demanding', 'Strict', 'Bossy', 'Managing',
          'Overseeing', 'Ruling',
        ],
      },
      {
        name: 'Protectiveness',
        words: [
          'Protective', 'Guarding', 'Shielding', 'Defensive', 'Watchful', 'Vigilant', 'Alert',
          'Hypervigilant', 'Cautious', 'Careful', 'Wary', 'Suspicious', 'Reactive', 'Ready',
        ],
      },
      {
        name: 'Perfectionism',
        words: [
          'Perfectionist', 'Exacting', 'Critical', 'Judgmental', 'Demanding', 'High-standards',
          'Uncompromising', 'Rigid', 'Inflexible', 'Intolerant', 'Fault-finding',
          'Never-satisfied', 'Excessively careful',
        ],
      },
      {
        name: 'Nurturing & Caretaking',
        words: [
          'Nurturing', 'Caretaking', 'Selfless', 'Giving', 'Supportive', 'Encouraging',
          'Affirming', 'Comforting', 'Soothing', 'Patient', 'Mothering', 'Fathering',
          'Parental', 'Tending',
        ],
      },
      {
        name: 'Avoidance & Withdrawal',
        words: [
          'Withdrawn', 'Avoidant', 'Reclusive', 'Isolated', 'Detached', 'Aloof', 'Remote',
          'Distancing', 'Invisible', 'Hiding', 'Disappearing', 'Shrinking', 'Fading',
        ],
      },
      {
        name: 'Playfulness & Creativity',
        words: [
          'Playful', 'Whimsical', 'Imaginative', 'Spontaneous', 'Artistic', 'Expressive',
          'Free-spirited', 'Adventurous', 'Explorative', 'Mischievous', 'Lighthearted',
          'Frivolous', 'Fun-loving',
        ],
      },
      {
        name: 'Loyalty & Commitment',
        words: [
          'Loyal', 'Devoted', 'Dedicated', 'Committed', 'Faithful', 'Steadfast', 'Reliable',
          'Trustworthy', 'Dependable', 'Constant', 'Unwavering', 'True',
        ],
      },
      {
        name: 'Courage & Boldness',
        words: [
          'Brave', 'Courageous', 'Bold', 'Daring', 'Fearless', 'Adventurous', 'Audacious',
          'Heroic', 'Valiant', 'Intrepid', 'Reckless (in service of protection)',
        ],
      },
      {
        name: 'Aggression & Force',
        words: [
          'Aggressive', 'Forceful', 'Combative', 'Confrontational', 'Hostile', 'Attacking',
          'Threatening', 'Menacing', 'Fierce', 'Ferocious', 'Dangerous', 'Violent (in imagery)',
        ],
      },
      {
        name: 'Manipulation & Strategy',
        words: [
          'Strategic', 'Calculating', 'Manipulative', 'Scheming', 'Political', 'Tactical',
          'Crafty', 'Cunning', 'Deceptive', 'Persuasive', 'Influential', 'Maneuvering',
        ],
      },
      {
        name: 'Wisdom & Insight',
        words: [
          'Wise', 'Sage-like', 'Ancient', 'Knowing', 'Intuitive', 'Far-seeing', 'Prophetic',
          'Deep', 'Profound', 'Enlightened', 'Aware', 'Conscious',
        ],
      },
      {
        name: 'Humor & Lightness',
        words: [
          'Humorous', 'Funny', 'Witty', 'Sarcastic', 'Ironic', 'Playful', 'Teasing', 'Light',
          'Breezy', 'Comic', 'Absurdist',
        ],
      },
      {
        name: 'Seriousness & Gravity',
        words: [
          'Serious', 'Grave', 'Solemn', 'Heavy', 'Weighty', 'Intense', 'Earnest', 'Somber',
          'Stoic', 'Unsmiling', 'Formal',
        ],
      },
      {
        name: 'Flexibility & Adaptability',
        words: [
          'Flexible', 'Adaptable', 'Easygoing', 'Go-with-the-flow', 'Open', 'Receptive',
          'Yielding', 'Adjusting', 'Accommodating', 'Versatile',
        ],
      },
      {
        name: 'Rigidity & Resistance',
        words: [
          'Rigid', 'Stubborn', 'Immovable', 'Fixed', 'Unyielding', 'Resistant', 'Defensive',
          'Entrenched', 'Dug-in', 'Inflexible', 'Unbudging',
        ],
      },
      {
        name: 'Sensitivity & Emotionality',
        words: [
          'Sensitive', 'Emotional', 'Feeling', 'Reactive', 'Responsive', 'Tender',
          'Easily-moved', 'Permeable', 'Impressionable', 'Vulnerable',
        ],
      },
      {
        name: 'Stoicism & Toughness',
        words: [
          'Stoic', 'Tough', 'Hard', 'Resilient', 'Enduring', 'Unaffected', 'Unmoved', 'Steely',
          'Iron-willed', 'Unbreakable', 'Self-contained',
        ],
      },
      {
        name: 'Helpfulness & Service',
        words: [
          'Helpful', 'Serving', 'Useful', 'Contributing', 'Sacrificing', 'Giving', 'Obliging',
          'Accommodating', 'Pleasing', 'Deferring',
        ],
      },
      {
        name: 'Independence & Autonomy',
        words: [
          'Independent', 'Self-reliant', 'Autonomous', 'Free', 'Self-sufficient',
          'Non-conformist', 'Individualistic', 'Sovereign', 'Lone wolf',
        ],
      },
      {
        name: 'Dependence & Reliance',
        words: [
          'Dependent', 'Reliant', 'Needy', 'Clingy', 'Attached', 'Seeking',
          'Leaning on others', 'Requiring reassurance',
        ],
      },
      {
        name: 'Vigilance & Watchfulness',
        words: [
          'Vigilant', 'Watchful', 'Scanning', 'Monitoring', 'Alert', 'Hyperaware', 'Tracking',
          'Scanning for danger', 'Never-relaxing',
        ],
      },
      {
        name: 'Impulsivity & Reactivity',
        words: [
          'Impulsive', 'Reactive', 'Spontaneous', 'Hasty', 'Reckless', 'Volatile', 'Explosive',
          'Hair-trigger', 'Snap-responding',
        ],
      },
      {
        name: 'Patience & Steadiness',
        words: [
          'Patient', 'Steady', 'Calm', 'Even-keeled', 'Unhurried', 'Methodical', 'Enduring',
          'Long-suffering', 'Tolerant',
        ],
      },
      {
        name: 'Rebellion & Defiance',
        words: [
          'Rebellious', 'Defiant', 'Resistant', 'Oppositional', 'Counter-dependent',
          'Anti-authority', 'Rule-breaking', 'Nonconformist', 'Revolutionary',
        ],
      },
      {
        name: 'Compliance & Obedience',
        words: [
          'Compliant', 'Obedient', 'Agreeable', 'Submissive', 'Deferential', 'People-pleasing',
          'Conflict-avoidant', 'Yes-saying',
        ],
      },
      {
        name: 'Ambition & Achievement',
        words: [
          'Ambitious', 'Achievement-oriented', 'Success-driven', 'Status-conscious', 'Striving',
          'Competing', 'Winning', 'Proving oneself',
        ],
      },
      {
        name: 'Acceptance & Contentment',
        words: [
          'Accepting', 'Content', 'At-peace', 'Surrendering', 'Non-striving', 'Allowing',
          'Letting-go', 'Flowing',
        ],
      },
      {
        name: 'Cynicism & Skepticism',
        words: [
          'Cynical', 'Skeptical', 'Doubtful', 'Disillusioned', 'World-weary', 'Jaded',
          'Sarcastic', 'Expecting-the-worst',
        ],
      },
      {
        name: 'Idealism & Vision',
        words: [
          'Idealistic', 'Visionary', 'Dreaming', 'Utopian', 'Hoping-for-better', 'Principled',
          'Value-driven', 'Mission-oriented',
        ],
      },
      {
        name: 'Practicality & Pragmatism',
        words: [
          'Practical', 'Pragmatic', 'Realistic', 'Down-to-earth', 'Problem-solving',
          'Results-focused', 'Concrete', 'Grounded', 'No-nonsense',
        ],
      },
      {
        name: 'Spirituality & Transcendence',
        words: [
          'Spiritual', 'Transcendent', 'Other-worldly', 'Mystical', 'Connected-to-something-larger',
          'Sacred', 'Divine', 'Seeking-meaning',
        ],
      },
      {
        name: 'Grief & Mourning',
        words: [
          'Grieving', 'Mourning', 'Lamenting', 'Sorrowful', 'Heartbroken', 'Aching with loss',
          'Carrying-old-pain',
        ],
      },
      {
        name: 'Joy & Celebration',
        words: [
          'Joyful', 'Celebrating', 'Exuberant', 'Festive', 'Thankful', 'Appreciating-life',
          'Radiant', 'Effervescent',
        ],
      },
      {
        name: 'Fear-Based Traits',
        words: [
          'Fearful', 'Frightened', 'Anticipating-danger', 'Worst-case-thinking', 'Safety-seeking',
          'Escape-oriented', 'Threat-scanning',
        ],
      },
      {
        name: 'Anger-Based Traits',
        words: [
          'Angry', 'Resentful', 'Indignant', 'Rights-claiming', 'Justice-seeking', 'Wronged',
          'Retaliating',
        ],
      },
      {
        name: 'Shame-Based Traits',
        words: [
          'Ashamed', 'Self-condemning', 'Hiding', 'Shrinking', 'Worthlessness-believing',
          'Self-punishing', 'Disappearing',
        ],
      },
      {
        name: 'Numbness & Dissociation',
        words: [
          'Numb', 'Shut-down', 'Dissociated', 'Absent', 'Gone-away', 'Checked-out',
          'Switched-off', 'Flatlined',
        ],
      },
    ],
  },
  {
    id: 'attitude',
    label: 'Attitude & Disposition',
    categories: [
      {
        name: 'Toward the World',
        words: [
          'Optimistic', 'Pessimistic', 'Realistic', 'Idealistic', 'Cynical', 'Distrustful',
          'Trusting', 'Suspicious', 'Open', 'Closed', 'Guarded', 'Receptive', 'Hostile',
          'Welcoming', 'Indifferent', 'Engaged', 'Curious', 'Fearful', 'Hopeful', 'Despairing',
          'Expectant', 'Withdrawn', 'Participatory', 'Observing',
        ],
      },
      {
        name: 'Toward Others',
        words: [
          'Warm', 'Cold', 'Friendly', 'Hostile', 'Trusting', 'Distrustful', 'Generous', 'Stingy',
          'Compassionate', 'Indifferent', 'Collaborative', 'Competitive', 'Caring', 'Uncaring',
          'Open', 'Guarded', 'Accepting', 'Rejecting', 'Supportive', 'Critical', 'Empathic',
          'Detached', 'Giving', 'Taking', 'Safe', 'Dangerous', 'Loving', 'Withholding',
        ],
      },
      {
        name: 'Toward Self',
        words: [
          'Self-accepting', 'Self-critical', 'Self-compassionate', 'Self-hating',
          'Self-protective', 'Self-sacrificing', 'Self-aware', 'Self-absorbed', 'Self-doubting',
          'Self-trusting', 'Self-punishing', 'Self-forgiving', 'Self-respecting', 'Self-loathing',
          'Self-caring', 'Self-neglecting', 'Self-honoring', 'Self-betraying',
        ],
      },
      {
        name: 'Toward Change',
        words: [
          'Open to change', 'Resistant to change', 'Fearful of change', 'Excited by change',
          'Adaptable', 'Rigid', 'Flexible', 'Frozen', 'Welcoming', 'Dreading',
          'Initiating change', 'Avoiding change', 'Incremental', 'Revolutionary', 'Cautious',
          'Reckless',
        ],
      },
      {
        name: 'Toward Authority',
        words: [
          'Deferential', 'Rebellious', 'Compliant', 'Independent', 'Defiant', 'Respectful',
          'Suspicious', 'Trusting', 'Submissive', 'Assertive', 'Challenging', 'Following',
          'Leading', 'Questioning', 'Accepting',
        ],
      },
      {
        name: 'Toward Risk',
        words: [
          'Risk-taking', 'Risk-averse', 'Cautious', 'Reckless', 'Calculated', 'Impulsive',
          'Bold', 'Timid', 'Adventurous', 'Conservative', 'Measured', 'Spontaneous',
          'Protective', 'Exposing',
        ],
      },
      {
        name: 'Toward Time',
        words: [
          'Past-focused', 'Future-focused', 'Present-focused', 'Nostalgic', 'Anticipatory',
          'Urgent', 'Patient', 'Hurried', 'Slow', 'Stuck-in-past', 'Dreading-future',
          'Savoring-present', 'Planning', 'Remembering', 'Rushing', 'Lingering',
        ],
      },
      {
        name: 'General Disposition',
        words: [
          'Heavy', 'Light', 'Expansive', 'Contracted', 'Open', 'Closed', 'Warm', 'Cold',
          'Bright', 'Dark', 'Lively', 'Flat', 'Engaged', 'Disengaged', 'Present', 'Absent',
          'Grounded', 'Unmoored', 'Stable', 'Volatile', 'Soft', 'Hard', 'Fluid', 'Fixed',
          'Inviting', 'Repelling',
        ],
      },
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    categories: [
      {
        name: 'Age',
        words: [
          'Young child (under 5)', 'Child (5-10)', 'Preteen', 'Teen', 'Young adult',
          'Middle-aged', 'Elder', 'Ancient', 'Ageless', 'Timeless', 'Infant', 'Very old',
          'Wizened', 'Newborn',
        ],
      },
      {
        name: 'Gender Expression',
        words: [
          'Masculine', 'Feminine', 'Androgynous', 'Neutral', 'Fluid', 'Genderless', 'Both',
          'Neither', 'Shifting', 'All genders',
        ],
      },
      {
        name: 'Size & Build',
        words: [
          'Tiny', 'Small', 'Medium', 'Large', 'Giant', 'Towering', 'Imposing', 'Slight', 'Frail',
          'Robust', 'Muscular', 'Soft', 'Stocky', 'Lanky', 'Compact', 'Enormous', 'Miniature',
          'Lifesize', 'Expanding', 'Shrinking',
        ],
      },
      {
        name: 'Color',
        words: [
          'White', 'Black', 'Gray', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Gold',
          'Silver', 'Brown', 'Pink', 'Teal', 'Indigo', 'Multicolored', 'Transparent', 'Iridescent',
          'Dark', 'Light', 'Bright', 'Muted', 'Shadowy', 'Glowing', 'Pulsing color',
          'Shifting color', 'Colorless',
        ],
      },
      {
        name: 'Texture',
        words: [
          'Smooth', 'Rough', 'Jagged', 'Soft', 'Hard', 'Fuzzy', 'Prickly', 'Metallic', 'Wooden',
          'Stony', 'Silky', 'Leathery', 'Scaly', 'Thorny', 'Velvety', 'Cracked', 'Weathered',
          'Worn', 'New', 'Ancient-feeling',
        ],
      },
      {
        name: 'Movement',
        words: [
          'Still', 'Frozen', 'Flowing', 'Jerky', 'Rapid', 'Slow', 'Graceful', 'Clumsy',
          'Purposeful', 'Erratic', 'Hovering', 'Pacing', 'Circling', 'Darting', 'Lurking',
          'Advancing', 'Retreating', 'Trembling', 'Rigid', 'Fluid', 'Dancing', 'Marching',
          'Prowling',
        ],
      },
      {
        name: 'Clothing & Covering',
        words: [
          'Formal', 'Casual', 'Armor', 'Robes', 'Uniform', 'Rags', 'Business attire',
          'Ancient clothing', 'Warrior gear', 'No clothing', 'Cloaked', 'Hooded', 'Masked',
          'Veiled', 'Elaborate', 'Simple', 'Torn', 'Pristine', 'Heavy', 'Light',
        ],
      },
      {
        name: 'Expression & Face',
        words: [
          'Stern', 'Kind', 'Sad', 'Angry', 'Blank', 'Frightened', 'Wise', 'Curious', 'Haunted',
          'Peaceful', 'Intense', 'Joyful', 'Pained', 'Determined', 'Vacant', 'Fierce', 'Gentle',
          'Weary', 'Hidden', 'Masked', 'Distorted', 'Beautiful', 'Monstrous', 'Childlike',
        ],
      },
      {
        name: 'Light & Energy',
        words: [
          'Glowing', 'Dark', 'Dim', 'Radiant', 'Shadowy', 'Ethereal', 'Solid', 'Transparent',
          'Pulsing', 'Still', 'Blazing', 'Faint', 'Flickering', 'Steady', 'Blinding', 'Invisible',
          'Present', 'Absent', 'Luminous', 'Murky',
        ],
      },
      {
        name: 'Temperature',
        words: [
          'Warm', 'Cold', 'Hot', 'Icy', 'Burning', 'Neutral', 'Freezing', 'Feverish',
          'Comfortable', 'Extreme', 'Fluctuating', 'Numbing',
        ],
      },
      {
        name: 'Sound',
        words: [
          'Silent', 'Whispering', 'Shouting', 'Humming', 'Crying', 'Laughing', 'Growling',
          'Sighing', 'Screaming', 'Singing', 'Chanting', 'Static', 'Buzzing', 'Clicking',
          'Thundering', 'Barely audible', 'Resonant', 'Hollow', 'Piercing',
        ],
      },
      {
        name: 'Location in Body',
        words: [
          'Head', 'Chest', 'Heart', 'Throat', 'Stomach', 'Gut', 'Back', 'Shoulders', 'Legs',
          'Arms', 'Whole body', 'Feet', 'Hands', 'Behind the eyes', 'In the jaw',
          'At the base of skull', 'Everywhere', 'Nowhere specific', 'Moving around',
        ],
      },
      {
        name: 'Environment',
        words: [
          'In a cave', 'In a room', 'In a forest', 'In darkness', 'In light', 'In water',
          'In a small space', 'In vast empty space', 'In a prison', 'In a garden', 'At the edge',
          'Underground', 'In the past', 'In a memory', 'Nowhere', 'Timeless space',
          'Familiar place', 'Unknown landscape',
        ],
      },
      {
        name: 'Form',
        words: [
          'Human', 'Animal', 'Hybrid creature', 'Monster', 'Angel', 'Demon', 'Robot', 'Ghost',
          'Shadow', 'Shapeless', 'Pure energy', 'Child-form', 'Elder-form', 'Warrior',
          'Protector', 'Healer', 'Destroyer', 'Ancient being',
          'Nature element (fire/water/wind/earth)',
        ],
      },
      {
        name: 'Objects & Symbols',
        words: [
          'Carrying a burden', 'Holding a shield', 'Holding a weapon', 'Wearing chains',
          'Carrying a key', 'Surrounded by fire', 'Surrounded by water', 'Encased in stone',
          'Behind glass', 'In a cage', 'Holding a child', 'Reaching out', 'Reaching away',
          'Bound', 'Free', 'Wounded', 'Whole', 'Marked', 'Branded',
        ],
      },
      {
        name: 'Symbolic Elements',
        words: [
          'Cast in shadow', 'Radiating light', 'Surrounded by walls', 'Trapped', 'Floating',
          'Falling', 'Rising', 'Dissolving', 'Solidifying', 'Fragmenting', 'Coalescing',
          'Behind a barrier', 'At a threshold', 'In transition', 'Emerging', 'Receding',
          'Expanding', 'Contracting',
        ],
      },
    ],
  },
]
