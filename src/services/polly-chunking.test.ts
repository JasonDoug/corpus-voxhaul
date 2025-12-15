
import { PollyTTSProvider } from './audio-synthesizer';
import { LectureAgent } from '../models/agent';
import { Readable } from 'stream';

// Mock AWS SDK v3
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-polly', () => ({
  PollyClient: jest.fn(() => ({ send: mockSend })),
  SynthesizeSpeechCommand: jest.fn((input) => ({ input })),
}));
jest.mock('../utils/config', () => ({
    config: { aws: { region: 'us-west-2' }, localstack: { useLocalStack: false } }
}));
jest.mock('./s3', () => ({
    uploadAudio: jest.fn()
}));

describe('PollyTTSProvider Chunking', () => {
    let provider: PollyTTSProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        // Default mock implementation for AWS SDK v3
        mockSend.mockImplementation(async (cmd: any) => {
            if (cmd.input.OutputFormat === 'mp3') {
                return { AudioStream: Readable.from([Buffer.from('mock-audio')]) };
            }
            if (cmd.input.OutputFormat === 'json') {
                // minimal JSON-lines speech marks stream
                return { AudioStream: Readable.from([Buffer.from('{"time":0,"type":"word","value":"Hi"}\n')]) };
            }
            throw new Error('unexpected OutputFormat');
        });
        provider = new PollyTTSProvider();
    });

    test('should split large text into multiple chunks', async () => {
        // Create text larger than 2800 chars
        // 300 words of 10 chars = 3000 chars
        const sentence = "This is a ten char word. ".repeat(150); // ~3750 chars

        const voiceConfig: LectureAgent['voice'] = {
            voiceId: 'Joanna',
            speed: 1.0,
            pitch: 0
        };

        const result = await provider.synthesize(sentence, voiceConfig);

        // Should have called send multiple times (2 MP3 calls + 2 speech marks calls = 4 total)
        const mp3Calls = mockSend.mock.calls.filter(([cmd]) => cmd.input?.OutputFormat === 'mp3');
        expect(mp3Calls.length).toBe(2);

        // Verify results
        expect(result.audioBuffer.length).toBeGreaterThan(0);
        // 2 chunks * 'mock-audio'.length (10) = 20
        expect(result.audioBuffer.equals(Buffer.concat([Buffer.from('mock-audio'), Buffer.from('mock-audio')]))).toBe(true);
    });

    test('should handle single chunk text normally', async () => {
        const text = "Small text.";
        const voiceConfig: LectureAgent['voice'] = {
            voiceId: 'Joanna',
            speed: 1.0,
            pitch: 0
        };

        await provider.synthesize(text, voiceConfig);
        
        // Should have called send twice (1 MP3 call + 1 speech marks call)
        const mp3Calls = mockSend.mock.calls.filter(([cmd]) => cmd.input?.OutputFormat === 'mp3');
        expect(mp3Calls.length).toBe(1);
        
        // Verify the text was passed correctly
        const mp3Command = mp3Calls[0][0];
        expect(mp3Command.input.Text).toBe(text);
    });
});
