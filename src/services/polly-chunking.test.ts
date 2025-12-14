
import { PollyTTSProvider } from './audio-synthesizer';
import { LectureAgent } from '../models/agent';

// Mock AWS SDK
const mockSynthesizeSpeech = jest.fn();
jest.mock('aws-sdk', () => {
    return {
        Polly: jest.fn(() => ({
            synthesizeSpeech: mockSynthesizeSpeech
        })),
        config: { update: jest.fn() }
    };
});
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
        // Default mock implementation
        mockSynthesizeSpeech.mockReturnValue({
            promise: jest.fn().mockResolvedValue({
                AudioStream: Buffer.from('mock-audio'),
            })
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

        // Should have called synthesizeSpeech multiple times
        expect(mockSynthesizeSpeech).toHaveBeenCalledTimes(2);

        // Verify results
        expect(result.audioBuffer.length).toBeGreaterThan(0);
        // 2 chunks * 'mock-audio'.length (10) = 20
        expect(result.audioBuffer.length).toBe(20);
    });

    test('should handle single chunk text normally', async () => {
        const text = "Small text.";
        const voiceConfig: LectureAgent['voice'] = {
            voiceId: 'Joanna',
            speed: 1.0,
            pitch: 0
        };

        await provider.synthesize(text, voiceConfig);
        expect(mockSynthesizeSpeech).toHaveBeenCalledTimes(1);
        const callArgs = mockSynthesizeSpeech.mock.calls[0][0];
        expect(callArgs.Text).toBe(text);
    });
});
