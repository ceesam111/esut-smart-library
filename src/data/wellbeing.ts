// ── Wellbeing Corner data: validated screening tools + supportive content ──────
// PSS-10 (Perceived Stress Scale), GAD-7 (anxiety), PHQ-9 (depression).
// These are widely-used self-report screeners. They are NOT a diagnosis.

export type ScaleKey = 'pss10' | 'gad7' | 'phq9';

export interface ScaleOption {
  label: string;
  value: number;
}

export interface ScaleBand {
  min: number;
  max: number;
  label: string;
  interpretation: string;
  tips: string[];
  /** when true, surface the counsellor referral panel */
  referral?: boolean;
}

export interface Scale {
  key: ScaleKey;
  title: string;
  subtitle: string;
  topic: 'Stress' | 'Anxiety' | 'Depression';
  instructions: string;
  options: ScaleOption[];
  questions: string[];
  /** indices (0-based) that are reverse-scored */
  reverse?: number[];
  bands: ScaleBand[];
}

const FREQ_OPTIONS_PSS: ScaleOption[] = [
  { label: 'Never', value: 0 },
  { label: 'Almost never', value: 1 },
  { label: 'Sometimes', value: 2 },
  { label: 'Fairly often', value: 3 },
  { label: 'Very often', value: 4 },
];

const FREQ_OPTIONS_DSM: ScaleOption[] = [
  { label: 'Not at all', value: 0 },
  { label: 'Several days', value: 1 },
  { label: 'More than half the days', value: 2 },
  { label: 'Nearly every day', value: 3 },
];

export const SCALES: Record<ScaleKey, Scale> = {
  pss10: {
    key: 'pss10',
    title: 'Perceived Stress Scale (PSS-10)',
    subtitle: 'How unpredictable, uncontrollable and overloaded you have felt this past month.',
    topic: 'Stress',
    instructions:
      'In the last month, how often have you felt or thought the following? There are no right or wrong answers.',
    options: FREQ_OPTIONS_PSS,
    reverse: [3, 4, 6, 7], // items 4,5,7,8 (1-based) are positively worded
    questions: [
      'Been upset because of something that happened unexpectedly?',
      'Felt that you were unable to control the important things in your life?',
      'Felt nervous and stressed?',
      'Felt confident about your ability to handle your personal problems?',
      'Felt that things were going your way?',
      'Found that you could not cope with all the things you had to do?',
      'Been able to control irritations in your life?',
      'Felt that you were on top of things?',
      'Been angered because of things outside of your control?',
      'Felt difficulties were piling up so high you could not overcome them?',
    ],
    bands: [
      {
        min: 0,
        max: 13,
        label: 'Low stress',
        interpretation:
          'Your perceived stress is in the low range. You generally feel able to cope with day-to-day demands.',
        tips: [
          'Keep up the routines that work for you — sleep, movement and connection.',
          'Notice early warning signs so you can act before stress builds.',
          'Use short study breaks to stay fresh and focused.',
        ],
      },
      {
        min: 14,
        max: 26,
        label: 'Moderate stress',
        interpretation:
          'Your perceived stress is in the moderate range. Some pressures may feel hard to control right now.',
        tips: [
          'Break large tasks into small, specific next steps.',
          'Protect 7–9 hours of sleep — it is the strongest stress buffer.',
          'Try the breathing exercise below for two minutes when tension rises.',
          'Talk to a friend, mentor or the library team — you don’t have to carry it alone.',
        ],
      },
      {
        min: 27,
        max: 40,
        label: 'High stress',
        interpretation:
          'Your perceived stress is in the high range. It may feel like demands are piling up faster than you can manage.',
        tips: [
          'Prioritise rest and basic needs before more work.',
          'Choose one thing to let go of or postpone this week.',
          'Reach out to someone you trust today.',
          'Consider speaking with a counsellor for extra support.',
        ],
        referral: true,
      },
    ],
  },
  gad7: {
    key: 'gad7',
    title: 'Generalised Anxiety Disorder (GAD-7)',
    subtitle: 'A short screen for symptoms of anxiety over the last two weeks.',
    topic: 'Anxiety',
    instructions:
      'Over the last 2 weeks, how often have you been bothered by the following problems?',
    options: FREQ_OPTIONS_DSM,
    questions: [
      'Feeling nervous, anxious or on edge',
      'Not being able to stop or control worrying',
      'Worrying too much about different things',
      'Trouble relaxing',
      'Being so restless that it is hard to sit still',
      'Becoming easily annoyed or irritable',
      'Feeling afraid as if something awful might happen',
    ],
    bands: [
      {
        min: 0,
        max: 4,
        label: 'Minimal anxiety',
        interpretation: 'Your responses suggest minimal anxiety symptoms.',
        tips: [
          'Maintain habits that keep you grounded.',
          'Use brief breathing breaks before high-pressure tasks.',
        ],
      },
      {
        min: 5,
        max: 9,
        label: 'Mild anxiety',
        interpretation: 'Your responses suggest mild anxiety symptoms.',
        tips: [
          'Name the worry, then ask: is this in my control right now?',
          'Limit caffeine and late-night screens.',
          'Try the breathing exercise and a short walk between study sessions.',
        ],
      },
      {
        min: 10,
        max: 14,
        label: 'Moderate anxiety',
        interpretation: 'Your responses suggest moderate anxiety symptoms.',
        tips: [
          'Schedule a short daily “worry window” instead of all-day worrying.',
          'Ground yourself with the 5-4-3-2-1 senses exercise.',
          'Consider talking with a counsellor about coping strategies.',
        ],
        referral: true,
      },
      {
        min: 15,
        max: 21,
        label: 'Severe anxiety',
        interpretation: 'Your responses suggest severe anxiety symptoms.',
        tips: [
          'Please reach out for support — you deserve help.',
          'Speak with a counsellor or your doctor soon.',
          'Use grounding and breathing tools to manage acute moments.',
        ],
        referral: true,
      },
    ],
  },
  phq9: {
    key: 'phq9',
    title: 'Patient Health Questionnaire (PHQ-9)',
    subtitle: 'A short screen for symptoms of low mood over the last two weeks.',
    topic: 'Depression',
    instructions:
      'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
    options: FREQ_OPTIONS_DSM,
    questions: [
      'Little interest or pleasure in doing things',
      'Feeling down, depressed or hopeless',
      'Trouble falling or staying asleep, or sleeping too much',
      'Feeling tired or having little energy',
      'Poor appetite or overeating',
      'Feeling bad about yourself — or that you are a failure or have let people down',
      'Trouble concentrating on things, such as reading or studying',
      'Moving or speaking so slowly that others could notice — or being fidgety/restless',
      'Thoughts that you would be better off dead, or of hurting yourself',
    ],
    bands: [
      {
        min: 0,
        max: 4,
        label: 'Minimal symptoms',
        interpretation: 'Your responses suggest minimal symptoms of low mood.',
        tips: ['Keep nurturing the activities and people that lift you.', 'Stay active and connected.'],
      },
      {
        min: 5,
        max: 9,
        label: 'Mild symptoms',
        interpretation: 'Your responses suggest mild symptoms of low mood.',
        tips: [
          'Plan one small enjoyable activity each day.',
          'Keep a gentle routine for sleep and meals.',
          'Share how you feel with someone you trust.',
        ],
      },
      {
        min: 10,
        max: 14,
        label: 'Moderate symptoms',
        interpretation: 'Your responses suggest moderate symptoms of low mood.',
        tips: [
          'Please consider speaking with a counsellor.',
          'Be kind to yourself — small steps count.',
          'Stay connected; isolation tends to deepen low mood.',
        ],
        referral: true,
      },
      {
        min: 15,
        max: 19,
        label: 'Moderately severe symptoms',
        interpretation: 'Your responses suggest moderately severe symptoms of low mood.',
        tips: [
          'Please speak with a counsellor or doctor soon.',
          'Reach out to someone today — you are not alone.',
        ],
        referral: true,
      },
      {
        min: 20,
        max: 27,
        label: 'Severe symptoms',
        interpretation: 'Your responses suggest severe symptoms of low mood.',
        tips: [
          'Please seek support as soon as you can.',
          'If you ever feel unsafe, contact a helpline or emergency services immediately.',
        ],
        referral: true,
      },
    ],
  },
};

export function scoreScale(scale: Scale, answers: number[]): number {
  return answers.reduce((sum, val, i) => {
    if (scale.reverse?.includes(i)) {
      const max = scale.options[scale.options.length - 1].value;
      return sum + (max - val);
    }
    return sum + val;
  }, 0);
}

export function bandFor(scale: Scale, score: number): ScaleBand {
  return scale.bands.find((b) => score >= b.min && score <= b.max) ?? scale.bands[scale.bands.length - 1];
}

// ── Support contacts (referral panel) ─────────────────────────────────────────
export const SUPPORT_CONTACTS = [
  {
    name: 'ESUT Counselling Unit',
    detail: 'Student counselling & guidance services on campus.',
    href: '/contact',
    cta: 'Contact the library',
  },
  {
    name: 'Nigeria Mental Health Helpline (Mentally Aware Nigeria — MANI)',
    detail: 'Free, confidential support line.',
    href: 'tel:08091116264',
    cta: 'Call 0809 111 6264',
  },
  {
    name: 'SURPIN Suicide Research & Prevention Initiative',
    detail: '24/7 crisis support in Nigeria.',
    href: 'tel:09080217555',
    cta: 'Call 0908 021 7555',
  },
];

// ── Motivational quotes ───────────────────────────────────────────────────────
export const QUOTES: { text: string; author: string }[] = [
  { text: 'You don’t have to see the whole staircase, just take the first step.', author: 'Martin Luther King Jr.' },
  { text: 'Almost everything will work again if you unplug it for a few minutes — including you.', author: 'Anne Lamott' },
  { text: 'Rest is not idleness; it is the key to a clear mind.', author: 'Unknown' },
  { text: 'The expert in anything was once a beginner.', author: 'Helen Hayes' },
  { text: 'Small progress is still progress.', author: 'Unknown' },
  { text: 'Take care of your body. It’s the only place you have to live.', author: 'Jim Rohn' },
  { text: 'You are allowed to be both a masterpiece and a work in progress.', author: 'Sophia Bush' },
  { text: 'Breathe. You’re going to be okay. Breathe and remember you’ve been in this place before.', author: 'Unknown' },
];

export function randomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
