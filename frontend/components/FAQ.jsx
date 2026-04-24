'use client'
import { useState } from 'react'
import { useTheme } from '@/context/ThemeContext'

const FONT = "'Jost', sans-serif"

export default function FAQ() {
  const { theme } = useTheme()
  const [openIndex, setOpenIndex] = useState(null)

  const faqs = [
    { title: 'What is a deepfake?', description: 'A deepfake is a form of synthetic media where artificial intelligence is used to create or manipulate content in a way that is difficult to distinguish from reality. Deepfakes can be come in the form of images, videos, or audio recordings that depict people saying or doing things they never actually said or did. Deepfakes are created using machine learning and neural networks, which analyze and learn from existing media to generate new content that mimics the original.' },
    { title: 'How does deepfake detection work?', description: 'Deepfake detection involves analyzing media content for inconsistencies or anomalies that are indicative of artificial manipulation. These techniques can include examining facial expressions, lip movements, and other subtle cues that are difficult to replicate accurately with current AI technology. AI models are trained on large datasets of both real and fake media to identify these telltale signs and then produce a confidence score on the likelihood of manipulation.' },
    { title: 'Why use a deepfake detector?', description: 'As synthetic media becomes more sophisticated, it is becoming increasingly difficult to distinguish between authentic and manipulated content. Deepfakes may be used to spread misinformation, create non-consensual explicit content, or impersonate individuals for malicious purposes. With a deepfake detector, you can help protect yourself and others from the potential harm caused by these deceptive technologies.' },
    { title: 'How effective are current deepfake detection tools?', description: 'Most modern deepfake detection tools achieve around 80-95% accuracy, depending on the file type, the quality of the deepfake, and the sophistication of the detection algorithm. In real-life settings, the effectiveness of these tools can vary, but they are proving to be useful in many cases. For example, a journalist can verify viral clips before writing articles, or a parent can check a voicemail that might be a scam.' },
    { title: 'What are the limitations of current deepfake detection tools?', description: 'Current deepfake detection tools have some limitations. They may struggle with high-quality deepfakes that are created using advanced techniques, and they can sometimes produce false positives or negatives. Audio deepfakes can be particularly difficult to detect because audio lacks the visual elements other deepfakes possess. Also, models trained on older datasets may not catch newer types of deepfakes.' },
    { title: 'What are the latest advancements in deepfake detection technology?', description: 'Most detectors support only one file type, but newer detectors are becoming multimodal, meaning they support multiple file types. More systems are integrating Convolutional Neural Networks (CNNs), Long Short-Term Memory (LSTM) networks, and Vision Transformers (ViT). Emerging technologies are also introducing blockchain-based content verification which provides immutable records of content authenticity.' },
    { title: 'What is the future of deepfake detection?', description: 'The future of deepfake detection is automation and context awareness. We might see deepfake detectors able to detect intent in the coming years, meaning it will be able to identify the underlying motives behind the creation of deepfakes. We can expect to see more high quality open-source datasets resulting in more accurate detection models. Higher accuracy will make results easier to trust and verify.' },
  ]

  const toggleBox = (index) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section 
      style={{ 
        width: '100%', 
        backgroundColor: theme.bg, 
        borderTop: `1px solid ${theme.border}`, 
        padding: '5rem 2rem', 
        boxSizing: 'border-box', 
        fontFamily: FONT, 
        transition: 'background-color 0.3s ease, border-color 0.3s ease' 
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <p style={{ 
          color: theme.muted, 
          fontSize: '0.65rem', 
          letterSpacing: '3px', 
          textTransform: 'uppercase', 
          margin: '0 0 0.75rem 0', 
          fontWeight: '700', 
          transition: 'color 0.3s ease' 
        }}>
          FAQ
        </p>
        <h2 style={{ 
          fontSize: '2rem', 
          fontWeight: '900', 
          color: theme.text, 
          letterSpacing: '2px', 
          textTransform: 'uppercase', 
          margin: 0, 
          transition: 'color 0.3s ease' 
        }}>
          Frequently Asked Questions
        </h2>
      </div>

      <div style={{ 
        maxWidth: '820px', 
        margin: '0 auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem' 
      }}>
        {faqs.map((faq, index) => (
          <div
            key={index}
            style={{
              backgroundColor: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '12px',
              overflow: 'hidden',
              transition: 'border-color 0.3s ease',
            }}
          >
            <button
              onClick={() => toggleBox(index)}
              style={{
                width: '100%',
                padding: '1.5rem',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: theme.text,
                fontSize: '1.1rem',
                fontWeight: '600',
                fontFamily: FONT,
                transition: 'background-color 0.3s ease',
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = theme.border}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <span>{faq.title}</span>
              <span style={{
                transition: 'transform 0.3s ease',
                transform: openIndex === index ? 'rotate(180deg)' : 'rotate(0deg)',
                fontSize: '1.5rem',
              }}>
                ▼
              </span>
            </button>

            <div
              style={{
                maxHeight: openIndex === index ? '500px' : '0px',
                overflow: 'hidden',
                transition: 'max-height 0.3s ease',
              }}
            >
              <div
                style={{
                  padding: '1.0rem 1.5rem 1.5rem 1.5rem',
                  color: theme.muted,
                  fontSize: '1rem',
                  lineHeight: '1.6',
                  borderTop: `1px solid ${theme.border}`,
                }}
              >
                {faq.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}