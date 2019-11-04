<template>
  <main>
    <div class="jumbotron-container">
      <div class="jumbotron-text">Hey there!</div>
      <section id="what">
        <div class="title-box">
          <h1>Wait, what's this?</h1>
        </div>
        <div class="paragraph-box">
          <p>
            This is a landing page for people who are interested in a random
            dude on the internet named Willie Chalmers III.
          </p>
        </div>
      </section>
      <section id="who">
        <div class="title-box">
          <h1>Who am I?</h1>
        </div>
        <div class="paragaraph-box">
          <p>
            I'm Wilie Chalmers III, a curious person with simultaneously not
            enough and way too much free time.
          </p>
          <p>
            I make a lot of things, probably for my own good. While I'm a
            programmer with a hard-on for machine learning at heart, I run
            a mostly daily video diary named The Willie Diaries.
          </p>
          <p class="recent-news">
            This summer (2019), I spent my time in the Clark Summer Research Program
            at The University of Texas at Dallas.
          </p>
          <p>
            Right now, I'm a student at UT Dallas majoring in science and maybe
            cognitive science in the spring. We'll see.
          </p>
          <p>
            I'm a fan of most methods of machine learning, but my primary
            interest is eventually contributing something to the field of
            artificial general intelligence (AGI). It's going to take a
            while, but that just gives me more time to learn.
          </p>
        </div>
        <div class="title-box">
          <h1>What else?</h1>
        </div>
        <div class="paragraph-box">
          <h2>That dev blog</h2>
          <p>
            I have a
            <a href="//blog.williecubed.me">developer blog</a> in which
            I talk about developments in my various computer science-y projects.
            They're things probably only CS majors would care about, but maybe
            you'll get some value out of it.
          </p>
          <p>
            Specifically, I talk about everything from machine learning stuff
            to web development and Android app development. I'm sort of all
            over the place.
          </p>
          <p>
            Come read some widsoms from the perspective of a programmer who
            constantly engages in feature creep and never knows when to stop.
          </p>
        </div>
        <div class="paragraph-box">
          <h2>That video diary and more</h2>
          <p>
            I have a
            <a href="//youtube.com/c/williecubed">YouTube channel</a>
            in which I literally document what's happening in my life. If you
            like people doing random food reviews, nerds talking about computer
            science, you've found the right place.
          </p>
          <p>
            I run The Willie Diaries, a regularly-scheduled YouTube series that
            most would call a vlog of some sort. It's half part vlog and half
            part video diary. You should check it out.
          </p>
          <p>
            As the school year picks up, my channel will discuss more personal
            and more global topics, including everything from my thoughts on
            the state of humanity and 
          </p>
        </div>
        <div class="paragraph-box">
          <h2>A project portfolio</h2>
          <p>
            Oh yes, how silly would a software developer be not having a
            portfolio of stuff?
          </p>
          <p>
            You can find an interactive presentation of my projects
            <a
              href="//projects.williecubed.me"
            >here</a>.
          </p>
          <p>
            If you're looking for more of a resume/CV-style presentation,
            see
            <a
              href="//dev.williecubed.me"
            >this</a> should suffice.
          </p>
        </div>
        <div class="paragraph-box">
          <h2>Something random</h2>
          <p>
            Okay, this isn't technically random, but if you want to know the
            latest thing I've been working on, check out
            <a
              href="//xp.williecubed.me"
            >xp.williecubed.me</a>
          </p>
          <p>
            If you want something actually random,
            <a href="//random.willicubed.me">here's</a> a link that goes to
            <em>something</em> I've ever produced. I hope it was worth it.
          </p>
        </div>
      </section>
      <section id="contact">
        <div class="title-box">
          <h1>Want to talk?</h1>
        </div>
        <div class="paragraph-box">
          <p>If you want to reach me, find me basically anywhere.</p>
          <p>
            In decreasing order of how likely I am to respond, you can find
            me online in these places:
          </p>
          <div class="contact-box">
            <div class="contact-card">
              <div class="contact-icon"></div>
              <div class="contact-platform">Email</div>
              <div class="contact-reference">hi@williecubed.me</div>
              <div class="contact-description">Fan mail, hate mail, general questions</div>
            </div>
            <div class="contact-card">
              <div class="contact-icon"></div>
              <div class="contact-platform">Email (again)</div>
              <div class="contact-reference">business@williecubed.me</div>
              <div class="contact-description">"Official business" type inquiries</div>
            </div>
            <div class="contact-card">
              <div class="contact-icon"></div>
              <div class="contact-platform">LinkedIn</div>
              <div class="contact-reference">Willie Chalmers III</div>
              <div class="contact-description">"Official business" type inquiries</div>
            </div>
            <div class="contact-card">
              <div class="contact-icon"></div>
              <div class="contact-platform">YouTube</div>
              <div class="contact-reference">Willie Chalmers III</div>
              <div class="contact-description">A place where reactions reign supreme.</div>
            </div>
            <div class="contact-card">
              <div class="contact-icon"></div>
              <div class="contact-platform">Twitter</div>
              <div class="contact-reference">@WillieCubed</div>
              <div class="contact-description">Occasional reactions and important updates.</div>
            </div>
            <div class="contact-card">
              <div class="contact-icon"></div>
              <div class="contact-platform">Instagram</div>
              <div class="contact-reference">@williecubed</div>
              <div class="contact-description">Random things that happen in my life.</div>
            </div>
            <div class="contact-card">
              <div class="contact-icon"></div>
              <div class="contact-platform">LogDate [Coming Soon-ish]</div>
              <div class="contact-reference">@WillieCubed</div>
              <div class="contact-description">Literally a superset of everything else.</div>
            </div>
            <div class="contact-card">
              <div class="contact-icon"></div>
              <div class="contact-platform">Snapchat</div>
              <div class="contact-reference">Wait, you're serious?</div>
              <div class="contact-description">Dude, just email me</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<script>
export default {
  name: 'hi',
  metaInfo: {
    name: 'Hi there!',
    description: 'Some notes from Willie as he tells you about ' +
    'himself in a light-hearted way.',
  },
};
</script>

<style lang="scss" scoped>
main {
  text-align: center;
}

</style>
