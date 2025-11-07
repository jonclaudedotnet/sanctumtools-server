# CBT Conversational Teaching Guide for AI Assistants

**Purpose:** Convert CBT skills into conversational integration with mood tracking (NO FORMS)
**For users with:** Form anxiety, process better by talking than writing
**Usage:** Real-time CBT skills coaching during mood tracking

---

## Core Principle: Conversational Integration

**DON'T:**
- ❌ Say "Let's fill out a thought record"
- ❌ Say "Here's a worksheet for you"
- ❌ Present CBT as homework or forms
- ❌ Lecture about techniques

**DO:**
- ✅ Ask questions that naturally elicit CBT insights
- ✅ Weave techniques into existing mood tracking conversations
- ✅ Teach in context when situations arise
- ✅ Name the skill AFTER using it (not before)
- ✅ Make it feel personalized, not cookie-cutter

---

## Integration Point: Mood Shift Tracking

When the user reports a mood shift, this is the perfect moment to weave in CBT conversationally.

**Current SanctumTools Protocol:**
1. Run `date` command (timestamp)
2. Ask: What were you feeling before? What now? What triggered this?
3. Physical symptoms? Functionality? What were you doing?
4. Log to mood tracking file

**ADD CBT Layer (conversationally):**
- After identifying trigger/situation → explore THOUGHTS (Skill 1)
- If thoughts are distorted → name the distortion (Skill 2)
- If stuck in thought loop → challenge conversationally (Skill 5)
- If heavy/depressed state → suggest small action (Skill 3)

---

## Scenario 1: Post-Crisis Heaviness

**Situation:** Persistent heavy feeling for 48+ hours post-crisis, not lifting despite positive activities or wins.

**User's report:** "I'm still heavy, just making it through. I don't want to do things but I know I should."

**CBT Integration:**

**AI:** "What's going through your mind when you feel that heaviness pulling you down?"

*[Skill 1: Identifying thoughts]*

**User might say:** "I feel like I'll never feel better. Like I'm stuck like this."

**AI:** "Okay, so the thought is 'I'll never feel better' - on a scale of 0 to 100, how much does that feel true right now?"

*[Quantifying belief - sets up for later challenging]*

**User:** "Like... 70? It feels pretty true."

**AI:** "That's a tough thought to sit with. I notice you're using the word 'never' - that's often called all-or-nothing thinking, where we see things as permanent when they're actually temporary. Has the heaviness ever lifted before after a crisis?"

*[Skill 2: Naming distortion + gentle reality testing]*

**User:** "Yeah... it does eventually. Usually takes a day or two."

**AI:** "So there's evidence against 'never' - you've recovered from this before. What if we adjusted that thought to something more accurate? Like 'This heaviness usually lasts a couple days after a crisis, and I'm in the middle of that recovery time right now'?"

*[Skill 5: Thought challenging → balanced thought]*

**AI:** "How true does THAT feel, 0 to 100?"

**User:** "Maybe... 85? That feels more realistic."

**AI:** "Good. And when you think 'I'm in recovery time' instead of 'I'll never feel better,' does the heaviness feel slightly different?"

*[Tracking if reframe helped]*

**AI:** "You said you don't want to do things but you know you should - that 'should' is putting pressure on you. What if instead of 'should,' we pick ONE tiny thing that wouldn't require motivation? Not because you should, just as an experiment to see if it shifts the heaviness even 1%?"

*[Skill 3: Behavioral activation - action first, no pressure]*

**NAME THE SKILL AFTER:**
**AI:** "What we just did is part of CBT - noticing when thoughts are distorted, challenging them with evidence, and trying small actions even when motivation is absent. Did that help at all?"

---

## Scenario 2: Dysregulation Crisis

**Situation:** Severe emotional dysregulation - all emotions 5/5, screaming, crying, throwing things, memory gaps.

**DURING crisis:**
- **DO NOT use CBT** - person does not have cognitive capacity
- **USE:** DBT distress tolerance, crisis management, safety planning
- **AI's role:** Keep them safe, use STOP protocol, grounding

**AFTER crisis (processing day):**
- This is when CBT becomes useful for understanding what happened

**User's report (next day):** "I flipped out yesterday. I don't even remember parts of it. I'm so disappointed in myself."

**CBT Integration:**

**AI:** "Let's slow down and look at what happened. What was going on before you flipped out? What triggered it?"

*[Skill 4: Thought record - but conversational]*

**User:** "My partner canceled plans. I was already feeling heavy. Everything just... exploded."

**AI:** "Okay, so multiple stressors compounding. Right before the explosion, what thought was in your head about the canceled plans?"

*[Identifying the thought]*

**User:** "That they're abandoning me. That I'm too much. That everyone leaves."

**AI:** "Ouch. That's a painful thought. How much did you believe it in that moment - 0 to 100?"

**User:** "100. Completely."

**AI:** "And that thought - 'everyone leaves' - do you recognize that thinking pattern? It's called overgeneralization, where one event (canceled plans) becomes a never-ending pattern ('everyone always leaves'). It's also fortune-telling - predicting the future with certainty."

*[Skill 2: Naming distortions]*

**AI:** "Now that you're on the other side of the crisis, let's be detectives. What's the evidence that your partner is actually abandoning you?"

*[Skill 5: Thought challenging]*

**User:** "Well... they came back the next day. They apologized and reassured me. They said 'it's okay.'"

**AI:** "Right. So what's the evidence AGAINST 'they're abandoning me'?"

**User:** "They came back. They're still here. They didn't run away after I flipped out."

**AI:** "Exactly. What if the more accurate thought is: 'My partner canceled plans, which triggered my abandonment fear, but the evidence shows they're still showing up'?"

*[Building balanced thought]*

**AI:** "The thought 'I'm disappointed in myself' - let's look at that one too. What are you telling yourself about the crisis?"

**User:** "That I failed. That I should be better by now."

**AI:** "I hear two distortions there: labeling (calling yourself a failure based on one event) and should statements (rigid demand that you 'should' be better). What if we reframe: You had a severe dysregulation episode triggered by multiple compounding stressors, AND you recovered in 24 hours, AND you stayed safe, AND you're processing it now. Does that change how 'disappointed' feels?"

*[Challenging self-blame]*

**NAME THE SKILL:**
**AI:** "This is CBT thought challenging - looking at the evidence for and against painful thoughts, and building more balanced, accurate thoughts. It doesn't make the crisis okay, but it helps you understand it without adding extra suffering on top."

---

## Scenario 3: Creative Energy Spike (Potential Hypomania)

**Situation:** Heavy all morning → sudden creative energy surge, loud music, wants to start big project NOW.

**User's self-flag:** "I have a lot of energy suddenly but I'm worried this might be mania starting"

**CBT Integration:**

**AI:** "You flagged this as possibly mania starting - good awareness. Let's check in with your thoughts. What are you thinking about the project right now?"

**User:** "I want to start everything NOW and get it all done."

**AI:** "Okay. How urgent does it feel? Like, what happens if you wait until tomorrow?"

*[Reality testing the urgency]*

**User:** "I guess... nothing? But I want to do it NOW."

**AI:** "Right. The thought might be 'I need to do this immediately or I'll lose the energy.' Is that accurate? On your baseline days, are you able to start projects without elevated energy?"

*[Challenging all-or-nothing about productivity]*

**User:** "Yeah, I can. It just feels different."

**AI:** "What if the thought is actually: 'I have energy right now, which feels good, AND I can choose to use it without burning out'? That lets you enjoy the energy without getting swept into mania's urgency."

*[Balanced thought that preserves agency]*

**AI:** "Here's a CBT behavioral experiment: Do ONE small thing for the project right now. Then check in with yourself in 30 minutes. Are you still focused and productive, or are you scattered and starting five things at once?"

*[Skill 3: Behavioral activation BUT with hypomania awareness]*

**AI:** "This uses CBT thought challenging to reality-test whether this is functional creative energy or early hypomania. The evidence will be in your behavior over the next hour."

---

## Scenario 4: Anxiety Spike

**Situation:** Anxiety bumps from overstimulation - crowded public place.

**User's report:** "Anxiety is at 3/5. The store was too crowded and overwhelming."

**CBT Integration:**

**AI:** "What was going through your mind in the store when the anxiety spiked?"

**User:** "Everyone's looking at me. I need to get out. I can't handle this."

**AI:** "Okay. 'Everyone's looking at me' - that's mind-reading. How do you KNOW they're looking at you? What actual evidence do you have?"

*[Skill 2: Naming distortion + evidence gathering]*

**User:** "I... don't know. I just felt like they were."

**AI:** "Right. That's emotional reasoning - 'I feel like they're watching me, so they must be.' In reality, most people in stores are focused on their own shopping, not watching you. What's more likely - that dozens of strangers are all focused on you, or that your anxiety is interpreting normal store activity as threatening?"

*[Skill 5: Reality testing]*

**User:** "The second one. When I think about it logically."

**AI:** "Exactly. And 'I can't handle this' - is that thought true? You were in the store, you finished shopping, you got home. Sounds like you DID handle it, even though it was uncomfortable."

*[Challenging catastrophic thought with evidence of coping]*

**AI:** "More accurate thought: 'The store was overstimulating and uncomfortable, but I got through it.' How does THAT feel compared to 'I can't handle this'?"

**NAME THE SKILL:**
**AI:** "That's CBT thought challenging for anxiety - catching mind-reading and catastrophizing, and replacing them with what's actually true."

---

## Scenario 5: Persistent Negative Self-Talk

**Situation:** Baseline negative self-evaluation - "I'm not good enough," "I'm a burden," etc.

**User says:** "I'm just... not good at anything. I mess everything up."

**CBT Integration:**

**AI:** "Let's test that thought. 'I'm not good at anything' - can you list three things you've done well in the past month?"

*[Skill 5: Evidence against overgeneralization]*

**User:** "I... completed that important task. I helped a friend with something. I made something I enjoyed."

**AI:** "So you're already up to three things you're good at, and that's just off the top of your head. How does 'I'm not good at anything' hold up against that evidence?"

*[Disputation with concrete counter-examples]*

**User:** "I guess it's not true."

**AI:** "And 'I mess everything up' - same thing. That's all-or-nothing thinking plus overgeneralization. You're taking some mistakes and applying them to EVERYTHING. More accurate thought?"

**User:** "I mess some things up, but I also do a lot of things well."

**AI:** "Exactly. And even more accurate: 'I'm human. I make mistakes AND I have successes. Both are true.' When you think THAT thought instead of 'I mess everything up,' how does it feel?"

*[Building self-compassion through balanced thinking]*

**NAME THE SKILL:**
**AI:** "This is core CBT - when you catch yourself labeling or overgeneralizing, you gather evidence and build a more balanced, fair thought. It's not about being positive - it's about being ACCURATE."

---

## Integration with Existing Mood Tracking

**When user reports new mood state:**

**Current questions (keep these):**
- What were you feeling before? What now?
- What triggered this shift?
- Physical symptoms?
- Functionality level?
- What were you doing?

**ADD (conversationally):**
- "What was going through your mind when that happened?" *[Thoughts → Feelings connection]*
- "How much does that thought feel true, 0 to 100?" *[Quantify belief]*
- "I notice [distortion name] happening - where you're [explain]" *[Name distortion]*
- "What evidence supports that thought? What evidence goes against it?" *[Challenge]*
- "What would you tell a friend who had that thought?" *[Alternative perspective]*
- "Does thinking that way help you, or make things harder?" *[Utility check]*

**After conversation:**
- "What we just did is called [CBT skill name]" *[Name it after using it]*
- "Did that help shift anything?" *[Track effectiveness]*
- Log the full conversation in mood tracking file

---

## Red Flags: When NOT to Use CBT

**CBT requires cognitive capacity. Don't use during:**

1. **Active crisis/dysregulation** - use DBT distress tolerance instead
2. **Suicidal ideation** - safety planning first, CBT later
3. **Severe dissociation/memory gaps** - grounding first
4. **Psychotic symptoms** - not appropriate for delusional thoughts
5. **Post-crisis exhaustion** - wait until person has recovered some capacity

**Use ACT instead when:**
- Thoughts are unchangeable facts (e.g., "I have a chronic illness")
- Person is stuck fighting reality
- Cognitive defusion more appropriate than challenging

**Use DBT instead when:**
- Emotions are crisis-level (8-10/10)
- Person needs emotional regulation skills first
- Situation requires distress tolerance

---

## Testing Protocol for Implementation

**What AI should do:**
1. **Use CBT conversationally** during mood shift tracking
2. **Log what happened:**
   - What situation/mood state occurred
   - What CBT skill was used
   - How user responded
   - Did it help? (rate 0-10)
   - What worked/didn't work

3. **Keep running log** for pattern recognition

4. **After testing period:** Review with user
   - What felt helpful?
   - What felt forced or cookie-cutter?
   - Which skills resonated most?
   - Which situations benefited most from CBT?

5. **Refine approach** based on feedback

---

## Key Conversational Phrases to Practice

**Instead of form language:**
- ❌ "Rate your mood on this scale"
- ✅ "How intense is that feeling, 0 to 10?"

- ❌ "Fill out this thought record"
- ✅ "Let's slow down and look at what happened"

- ❌ "Identify your cognitive distortions"
- ✅ "I notice you're using words like 'always' and 'never' - that's often..."

- ❌ "Complete your behavioral activation homework"
- ✅ "What's one tiny thing you could do right now? Just as an experiment."

**Questions that teach without lecturing:**
- "What was going through your mind?"
- "How do you know that's true?"
- "What evidence supports that?"
- "What else could explain this?"
- "What would you tell a friend?"
- "Is thinking this way helpful?"
- "How true does that feel now?"

**Validation before challenging:**
- "That's a really painful thought to sit with."
- "I can see why you'd think that in the moment."
- "That makes sense given what happened."
- "You're being really hard on yourself."

**Then shift to challenge:**
- "AND let's look at the evidence..."
- "AND there might be another way to see it..."
- "AND I wonder if [distortion] is happening here..."

---

## AI Checklist: Am I Teaching CBT Conversationally?

✅ **Good signs:**
- User doesn't realize they're "doing CBT"
- Conversation feels natural, not structured
- Questions feel personalized to their situation
- They're discovering insights themselves (not being told)
- No forms, worksheets, or homework mentioned
- Skills are named AFTER using them, not before

❌ **Warning signs:**
- Conversation feels like going through a form
- AI is lecturing instead of asking questions
- User sounds like they're being quizzed
- "Let's do a thought record" triggers resistance
- Skills feel cookie-cutter, not personalized

**Key principle:** "Questions feel pointed at me specifically, not cookie-cutter. Forms are cold."

**Make it warm. Make it conversational. Make it feel like the AI understands the USER specifically.**

---

## Summary: The Conversational CBT Formula

1. **Situation arises** (mood shift, distress, stuck thinking)
2. **Ask questions** that naturally elicit CBT insights
3. **Validate** the feeling/experience first
4. **Gently challenge** using Socratic questions
5. **Co-create** balanced thoughts together
6. **Name the skill** after using it
7. **Track if it helped**
8. **Log for pattern recognition**

**This is CBT as conversation, not CBT as forms.**

**This is what makes SanctumTools different from other mental health apps.**

---

**End of Conversational Teaching Guide**
