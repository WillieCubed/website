import Script from 'next/script';

export default function Head() {
  return (
    <>
      <meta charSet="utf-8" />
      <link rel="icon" href="/favicon.ico" />

      <title>Willie Chalmers III</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />

      <meta
        name="description"
        content="Willie Chalmers III is a student studying computer science at The University of Texas at Dallas and doing research in artficial intelligence. See what he's working on here."
      />

      <meta property="og:title" content="Willie Chalmers III" />
      <meta
        property="og:description"
        content="Willie Chalmers III is a student studying computer science at The University of Texas at Dallas and doing research in artficial intelligence. See what he's working on here."
      />
      <meta property="og:image" content="/assets/headshot.jpg" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://williecubed.me" />

      {process.env.NODE_ENV === 'production' && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GTAG_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            
            gtag('config', '${process.env.NEXT_PUBLIC_GTAG_ID}');
            `}
          </Script>
        </>
      )}
    </>
  );
}
