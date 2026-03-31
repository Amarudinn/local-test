'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { deployDebateContract } from '@/lib/genlayer-client';
import { supabaseApi } from '@/lib/supabase-client';
import { useGenLayerSigner } from '@/lib/hooks/useGenLayerSigner';
import {
  DURATION_OPTIONS,
  durationToHours,
  durationToMinutes,
  VALIDATION,
  PARTICIPANT_OPTIONS,
  DEFAULT_MAX_PARTICIPANTS,
  DEFAULT_EVALUATION_CRITERIA,
  type CreateDebateFormData,
  type EvaluationCriteria,
  type DebateSourceType
} from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { logger, LogCategory } from '@/lib/logger';
import { toast } from '@/lib/toast';
import { Info, Link2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { uploadToPinata } from '@/lib/pinata';
import { ImageIcon, X, Loader2 } from 'lucide-react';

const CRITERIA_DESCRIPTIONS = {
  logic_reasoning: "Is the argument logically sound and well-reasoned?",
  evidence_facts: "Does it provide credible evidence and facts?",
  clarity: "Is it clear and easy to understand?",
  relevance: "Is it relevant to the debate topic?",
  originality: "Does it offer unique perspectives or creative insights?",
  persuasiveness: "How convincing and compelling is the argument?",
};

interface CreateDebateFormProps {
  onSuccess?: (contractAddress: string) => void;
  onCancel?: () => void;
}

export function CreateDebateForm({ onSuccess, onCancel }: CreateDebateFormProps) {
  const router = useRouter();
  const { authenticated, user } = usePrivy();
  const { ready: signerReady, client, walletAddress } = useGenLayerSigner();

  // Source mode state
  const [sourceMode, setSourceMode] = useState<DebateSourceType>('manual');
  const [tweetUrl, setTweetUrl] = useState('');
  const [isFetchingTweet, setIsFetchingTweet] = useState(false);
  const [tweetData, setTweetData] = useState<{
    id: string;
    text: string;
    author_name: string;
    author_handle: string;
    url: string;
  } | null>(null);
  const [tweetError, setTweetError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateDebateFormData>({
    topic: '',
    description: '',
    duration: '24h', // Default to 24 hours
  });

  // Custom participants state
  const [useCustomParticipants, setUseCustomParticipants] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(DEFAULT_MAX_PARTICIPANTS);

  // Custom evaluation criteria state
  const [useCustomCriteria, setUseCustomCriteria] = useState(false);
  const [criteria, setCriteria] = useState<EvaluationCriteria>({ ...DEFAULT_EVALUATION_CRITERIA });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateDebateFormData, string>>>({})
  const [generalError, setGeneralError] = useState<string>('');

  // Image Upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  /**
   * Fetch tweet content from URL
   */
  const handleFetchTweet = async () => {
    if (!tweetUrl.trim()) {
      setTweetError('Please enter a tweet URL');
      return;
    }

    // Validate URL format
    if (!tweetUrl.match(/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/i)) {
      setTweetError('Invalid URL. Please use a valid Twitter/X post URL (e.g., https://x.com/user/status/123)');
      return;
    }

    setIsFetchingTweet(true);
    setTweetError(null);

    try {
      const response = await fetch('/api/fetch-tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tweetUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tweet');
      }

      if (data.success && data.tweet) {
        setTweetData(data.tweet);
        // Auto-fill topic with tweet content
        if (data.tweet.text) {
          setFormData(prev => ({ ...prev, topic: data.tweet.text }));
        }
        if (data.warning) {
          setTweetError(data.warning);
        }
      }
    } catch (error) {
      setTweetError(error instanceof Error ? error.message : 'Failed to fetch tweet');
    } finally {
      setIsFetchingTweet(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error("Image size too large (max 5MB)");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    const input = document.getElementById('cover-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  /**
   * Validate form data
   * Returns true if valid, false otherwise
   */
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateDebateFormData, string>> = {};

    // Validate topic
    if (sourceMode === 'tweet') {
      // In tweet mode, topic must be auto-filled from fetched tweet
      if (!formData.topic.trim()) {
        newErrors.topic = 'Please fetch a tweet first';
      }
    } else {
      if (!formData.topic.trim()) {
        newErrors.topic = 'Topic is required';
      } else if (formData.topic.length < VALIDATION.TOPIC_MIN_LENGTH) {
        newErrors.topic = `Topic must be at least ${VALIDATION.TOPIC_MIN_LENGTH} character`;
      } else if (formData.topic.length > VALIDATION.TOPIC_MAX_LENGTH) {
        newErrors.topic = `Topic must be ${VALIDATION.TOPIC_MAX_LENGTH} characters or less`;
      }
    }

    // Validate description
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < VALIDATION.DESCRIPTION_MIN_LENGTH) {
      newErrors.description = `Description must be at least ${VALIDATION.DESCRIPTION_MIN_LENGTH} character`;
    } else if (formData.description.length > VALIDATION.DESCRIPTION_MAX_LENGTH) {
      newErrors.description = `Description must be ${VALIDATION.DESCRIPTION_MAX_LENGTH} characters or less`;
    }

    // Validate duration
    if (!formData.duration) {
      newErrors.duration = 'Duration is required';
    } else if (!DURATION_OPTIONS.find(opt => opt.value === formData.duration)) {
      newErrors.duration = 'Please select a valid duration';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setGeneralError('');

    // Check authentication
    if (!authenticated || !user) {
      setGeneralError('You must be logged in to create a debate');
      return;
    }

    // Check if signer is ready
    if (!signerReady || !client) {
      setGeneralError('Wallet is not ready. Please wait a moment and try again.');
      return;
    }

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      logger.info(LogCategory.UI, 'Creating debate', {
        metadata: { topic: formData.topic, duration: formData.duration }
      });

      // Convert duration to minutes for both contract and database (integer)
      const durationMinutes = durationToMinutes(formData.duration);

      // Prepare parameters
      const finalMaxParticipants = useCustomParticipants ? maxParticipants : DEFAULT_MAX_PARTICIPANTS;
      const finalCriteria = useCustomCriteria ? criteria : DEFAULT_EVALUATION_CRITERIA;

      // Upload Image if selected
      let finalImageUrl: string | null = null;
      if (imageFile) {
        try {
          setIsUploadingImage(true);
          finalImageUrl = await uploadToPinata(imageFile);
          if (!finalImageUrl) {
            toast.warning("Failed to upload image, continuing without it.");
          }
        } catch (error) {
          console.error("Image upload error:", error);
          toast.warning("Image upload failed, debate will be created without cover.");
        } finally {
          setIsUploadingImage(false);
        }
      }

      // Deploy contract to blockchain using client from hook
      const { contractAddress } = await deployDebateContract(
        client,
        formData.topic.trim(),
        formData.description.trim(),
        durationMinutes, // Send minutes as integer to contract
        finalMaxParticipants,
        finalCriteria
      );

      logger.info(LogCategory.UI, 'Contract deployed successfully', {
        contractAddress,
        metadata: { topic: formData.topic }
      });

      // HYBRID APPROACH: Try immediate sync with retry, fallback to queue if it fails
      // Database will calculate end_time = created_at + duration_minutes for UI countdown
      // Contract timer starts when first participant joins (for blockchain logic)

      let syncSuccess = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!syncSuccess && retryCount < maxRetries) {
        try {
          // Calculate end_time for database (timer starts NOW for UI)
          const now = new Date();
          // Calculate end_time using minutes
          const endTime = new Date(now.getTime() + durationMinutes * 60 * 1000);

          // Wait a bit before first retry (give blockchain time to process)
          if (retryCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            console.log(`Retry ${retryCount}/${maxRetries} - Attempting to sync debate...`);
          }

          // Create debate directly in database (no need to fetch from blockchain)
          await supabaseApi.createDebate({
            contract_address: contractAddress,
            topic: formData.topic.trim(),
            description: formData.description.trim(),
            duration_minutes: durationMinutes, // Use minutes (INTEGER)
            end_time: endTime,
            status: 'OPEN',
            participant_count: 0,
            max_participants: finalMaxParticipants, // Custom or default (10)
            evaluation_criteria: finalCriteria as unknown as Record<string, number>,
            last_synced_at: null,
            image_url: finalImageUrl,
            source_type: sourceMode,
            source_url: sourceMode === 'tweet' ? (tweetData?.url || tweetUrl) : null,
            source_content: sourceMode === 'tweet' ? (tweetData?.text || null) : null,
          } as any);

          syncSuccess = true;
          logger.info(LogCategory.UI, 'Debate synced successfully', {
            contractAddress,
            metadata: { topic: formData.topic, retryCount }
          });

          // Show success message
          toast.success('Debate created successfully!', 'Your debate is now live.');

        } catch (syncError) {
          retryCount++;

          if (retryCount >= maxRetries) {
            // Max retries reached, try to queue for background processing
            logger.warn(LogCategory.UI, 'Immediate sync failed after retries, attempting to queue', {
              contractAddress,
              metadata: {
                error: syncError instanceof Error ? syncError.message : String(syncError),
                topic: formData.topic,
                retries: retryCount
              }
            });

            // Skip queueing if sync_queue table doesn't exist yet
            const errorMessage = syncError instanceof Error ? syncError.message : '';
            if (errorMessage.includes('sync_queue') || errorMessage.includes('attempts')) {
              logger.warn(LogCategory.UI, 'Sync queue table not ready, skipping queue', {
                contractAddress,
                metadata: { topic: formData.topic }
              });

              // Show success message anyway (contract is deployed)
              toast.success(
                'Debate created successfully!',
                'Your debate has been deployed. Please refresh the page in a few minutes to see it.'
              );
              break;
            }

            try {
              await supabaseApi.queueSyncOperation({
                sync_type: 'debate_creation',
                contract_address: contractAddress,
                participant_address: null,
                payload: {
                  topic: formData.topic.trim(),
                  description: formData.description.trim(),
                  durationMinutes,
                  creatorAddress: walletAddress,
                },
                attempts: 0,
                max_attempts: 5,
                next_retry_at: new Date(Date.now() + 60000), // Retry in 1 minute
                status: 'pending',
                last_error: null,
              });

              logger.info(LogCategory.UI, 'Debate queued for background sync', {
                contractAddress,
                metadata: { topic: formData.topic }
              });

              // Show success message with note about delay
              toast.success(
                'Debate created successfully!',
                'Your debate will appear in a few minutes as the blockchain processes it.'
              );

            } catch (queueError) {
              // Even queueing failed - log but don't fail the whole operation
              logger.error(
                LogCategory.UI,
                'Failed to queue sync operation',
                queueError instanceof Error ? queueError : new Error(String(queueError))
              );

              // Show success message anyway (contract is deployed)
              toast.success(
                'Debate created successfully!',
                'Your debate has been deployed. Please refresh in a few minutes.'
              );
            }
          }
        }
      }

      // Call success callback or redirect (proceed even if sync failed)
      if (onSuccess) {
        onSuccess(contractAddress);
      } else {
        // Redirect to debates list instead of detail page to avoid read errors
        router.push('/debates');
      }
    } catch (error) {
      logger.error(
        LogCategory.UI,
        'Failed to create debate',
        error instanceof Error ? error : new Error(String(error))
      );

      // Set user-friendly error message
      if (error instanceof Error) {
        setGeneralError(error.message);
      } else {
        setGeneralError('Failed to create debate. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle input changes
   */
  const handleChange = (
    field: keyof CreateDebateFormData,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Character counts
  const topicCharCount = formData.topic.length;
  const descriptionCharCount = formData.description.length;

  return (
    <TooltipProvider delayDuration={0}>
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-lg md:text-xl">Create New Debate</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Start a new debate and invite others to participate. The debate will be judged by AI based on logic, evidence, and clarity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            {/* Source Mode Toggle */}
            <div className="space-y-2">
              <Label className="text-sm md:text-base">Debate Source</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('manual');
                    setTweetData(null);
                    setTweetUrl('');
                    setTweetError(null);
                    setFormData(prev => ({ ...prev, topic: '' }));
                  }}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    sourceMode === 'manual'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-muted-foreground/50 text-muted-foreground'
                  }`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 8.25V18C20 21 18.21 22 16 22H8C5.79 22 4 21 4 18V8.25C4 5 5.79 4.25 8 4.25C8 4.87 8.24997 5.43 8.65997 5.84C9.06997 6.25 9.63 6.5 10.25 6.5H13.75C14.99 6.5 16 5.49 16 4.25C18.21 4.25 20 5 20 8.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 4.25C16 5.49 14.99 6.5 13.75 6.5H10.25C9.63 6.5 9.06997 6.25 8.65997 5.84C8.24997 5.43 8 4.87 8 4.25C8 3.01 9.01 2 10.25 2H13.75C14.37 2 14.93 2.25 15.34 2.66C15.75 3.07 16 3.63 16 4.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path opacity="0.4" d="M8 13H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path opacity="0.4" d="M8 17H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('tweet');
                    setFormData(prev => ({ ...prev, topic: '' }));
                  }}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    sourceMode === 'tweet'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-muted-foreground/50 text-muted-foreground'
                  }`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 300 300.251" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M178.57 127.15 290.27 0h-26.46l-97.03 110.38L89.34 0H0l117.13 166.93L0 300.25h26.46l102.4-116.59 81.8 116.59h89.34M36.01 19.54H76.66l187.13 262.13h-40.66"/></svg>
                  From Tweet
                </button>
              </div>
            </div>

            {/* Tweet URL Input (Tweet mode only) */}
            {sourceMode === 'tweet' && (
              <div className="space-y-3">
                <Label htmlFor="tweet-url" className="text-sm md:text-base">
                  Tweet URL <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="tweet-url"
                    placeholder="https://x.com/user/status/123456..."
                    value={tweetUrl}
                    onChange={(e) => {
                      setTweetUrl(e.target.value);
                      setTweetError(null);
                    }}
                    disabled={isSubmitting || isFetchingTweet}
                    className={`flex-1 text-sm md:text-base ${tweetError ? 'border-red-500' : ''}`}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleFetchTweet}
                    disabled={isSubmitting || isFetchingTweet || !tweetUrl.trim()}
                    className="flex-shrink-0"
                  >
                    {isFetchingTweet ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Fetching...</>
                    ) : (
                      <><Link2 className="h-4 w-4 mr-1" /> Fetch</>
                    )}
                  </Button>
                </div>
                {tweetError && (
                  <p className="text-xs text-red-500">{tweetError}</p>
                )}

                {/* Tweet Preview */}
                {tweetData && tweetData.text && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                        {tweetData.author_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{tweetData.author_name}</div>
                        <div className="text-xs text-muted-foreground">{tweetData.author_handle}</div>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{tweetData.text}</p>
                    <a
                      href={tweetData.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link2 className="h-3 w-3" />
                      View original tweet
                    </a>
                  </div>
                )}

                {/* Show topic validation error in tweet mode */}
                {errors.topic && (
                  <p className="text-xs text-red-500">{errors.topic}</p>
                )}
              </div>
            )}

            {/* Topic Field - Only show in Manual mode */}
            {sourceMode === 'manual' && (
              <div className="space-y-2">
                <Label htmlFor="topic" className="text-sm md:text-base">
                  Topic <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="topic"
                  placeholder="Enter debate topic..."
                  value={formData.topic}
                  onChange={(e) => handleChange('topic', e.target.value)}
                  disabled={isSubmitting}
                  className={`text-sm md:text-base ${errors.topic ? 'border-red-500' : ''}`}
                  maxLength={VALIDATION.TOPIC_MAX_LENGTH}
                />
                <div className="flex justify-between items-start gap-2 text-xs md:text-sm flex-wrap">
                  <span className={`flex-1 ${errors.topic ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {errors.topic || 'A clear, concise statement of the debate topic'}
                  </span>
                  <span className={`text-muted-foreground flex-shrink-0 ${topicCharCount > VALIDATION.TOPIC_MAX_LENGTH ? 'text-red-500' : ''}`}>
                    {topicCharCount}/{VALIDATION.TOPIC_MAX_LENGTH}
                  </span>
                </div>
              </div>
            )}

            {/* Cover Image Field (Optional) */}
            <div className="space-y-2">
              <Label className="text-sm md:text-base">Cover Image (Optional)</Label>
              <div
                className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors relative min-h-[120px]"
                onClick={() => document.getElementById('cover-upload')?.click()}
              >
                {imagePreview ? (
                  <div className="relative w-full aspect-video max-h-[200px] rounded-md overflow-hidden bg-muted">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-md z-10"
                      onClick={(e) => { e.stopPropagation(); removeImage(); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-medium">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Uploading...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-4">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground font-medium">Click to upload cover image</p>
                    <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                      Leave empty to use an auto-generated abstract gradient
                    </p>
                  </div>
                )}
                <input
                  id="cover-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                  disabled={isSubmitting || isUploadingImage}
                />
              </div>
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm md:text-base">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Provide context and details about the debate..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                disabled={isSubmitting}
                className={`min-h-[100px] md:min-h-[120px] text-sm md:text-base ${errors.description ? 'border-red-500' : ''}`}
                maxLength={VALIDATION.DESCRIPTION_MAX_LENGTH}
              />
              <div className="flex justify-between items-start gap-2 text-xs md:text-sm flex-wrap">
                <span className={`flex-1 ${errors.description ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {errors.description || 'Explain the debate topic, provide context, and set expectations'}
                </span>
                <span className={`text-muted-foreground flex-shrink-0 ${descriptionCharCount > VALIDATION.DESCRIPTION_MAX_LENGTH ? 'text-red-500' : ''}`}>
                  {descriptionCharCount}/{VALIDATION.DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
            </div>

            {/* Duration Field */}
            <div className="space-y-2">
              <Label htmlFor="duration" className="text-sm md:text-base">
                Duration <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.duration}
                onValueChange={(value) => handleChange('duration', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="duration" className={`text-sm md:text-base ${errors.duration ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder="Select debate duration" />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-sm md:text-base">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={`text-xs md:text-sm ${errors.duration ? 'text-red-500' : 'text-muted-foreground'}`}>
                {errors.duration || 'How long participants have to submit arguments'}
              </p>
            </div>

            {/* Max Participants Field */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-sm md:text-base font-medium">
                  Max Participants
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {useCustomParticipants ? 'Custom' : 'Default (10)'}
                  </span>
                  <Switch
                    checked={useCustomParticipants}
                    onCheckedChange={(checked) => {
                      setUseCustomParticipants(checked);
                      if (checked) {
                        setMaxParticipants(20); // Default to 20 when custom is enabled
                      } else {
                        setMaxParticipants(10); // Reset to default
                      }
                    }}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {useCustomParticipants && (
                <Select
                  value={String(maxParticipants)}
                  onValueChange={(value) => setMaxParticipants(Number(value))}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="text-sm md:text-base">
                    <SelectValue placeholder="Select max participants" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTICIPANT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)} className="text-sm md:text-base">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <p className="text-xs text-muted-foreground">
                {useCustomParticipants
                  ? (maxParticipants === 0 ? 'No limit on participants' : `Maximum ${maxParticipants} participants can join`)
                  : 'Default allows up to 10 participants'
                }
              </p>
            </div>

            {/* Evaluation Criteria Field */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-sm md:text-base font-medium">
                  Evaluation Criteria
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {useCustomCriteria ? 'Custom' : 'Default'}
                  </span>
                  <Switch
                    checked={useCustomCriteria}
                    onCheckedChange={(checked) => {
                      setUseCustomCriteria(checked);
                      if (!checked) {
                        setCriteria({ ...DEFAULT_EVALUATION_CRITERIA });
                      }
                    }}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {useCustomCriteria ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Logic & Reasoning</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="max-w-xs text-xs">{CRITERIA_DESCRIPTIONS.logic_reasoning}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={criteria.logic_reasoning}
                        onChange={(e) => setCriteria(prev => ({ ...prev, logic_reasoning: Number(e.target.value) || 0 }))}
                        disabled={isSubmitting}
                        className="text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Evidence & Facts</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="max-w-xs text-xs">{CRITERIA_DESCRIPTIONS.evidence_facts}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={criteria.evidence_facts}
                        onChange={(e) => setCriteria(prev => ({ ...prev, evidence_facts: Number(e.target.value) || 0 }))}
                        disabled={isSubmitting}
                        className="text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Clarity</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="max-w-xs text-xs">{CRITERIA_DESCRIPTIONS.clarity}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={criteria.clarity}
                        onChange={(e) => setCriteria(prev => ({ ...prev, clarity: Number(e.target.value) || 0 }))}
                        disabled={isSubmitting}
                        className="text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Relevance</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="max-w-xs text-xs">{CRITERIA_DESCRIPTIONS.relevance}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={criteria.relevance}
                        onChange={(e) => setCriteria(prev => ({ ...prev, relevance: Number(e.target.value) || 0 }))}
                        disabled={isSubmitting}
                        className="text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Originality</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="max-w-xs text-xs">{CRITERIA_DESCRIPTIONS.originality}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={criteria.originality}
                        onChange={(e) => setCriteria(prev => ({ ...prev, originality: Number(e.target.value) || 0 }))}
                        disabled={isSubmitting}
                        className="text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Persuasiveness</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="max-w-xs text-xs">{CRITERIA_DESCRIPTIONS.persuasiveness}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={criteria.persuasiveness}
                        onChange={(e) => setCriteria(prev => ({ ...prev, persuasiveness: Number(e.target.value) || 0 }))}
                        disabled={isSubmitting}
                        className="text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  {/* Total Counter */}
                  {(() => {
                    const total = criteria.logic_reasoning + criteria.evidence_facts + criteria.clarity +
                      criteria.relevance + criteria.originality + criteria.persuasiveness;
                    const isValid = total === 100;
                    return (
                      <div className="flex items-center justify-end">
                        <span className={`text-sm font-bold ${isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {total}/100 {isValid ? '' : `(${total < 100 ? 'Need ' + (100 - total) + ' more' : 'Reduce by ' + (total - 100)})`}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Default weights:</p>
                  <p>Logic: 25, Evidence: 20, Clarity: 15, Relevance: 15, Originality: 15, Persuasiveness: 10</p>
                </div>
              )}
            </div>

            {/* General Error Message */}
            {generalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-xs md:text-sm text-red-600 break-words">{generalError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto text-sm md:text-base"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting || !authenticated || !signerReady}
                className="w-full sm:w-auto text-sm md:text-base"
              >
                {isSubmitting ? 'Creating Debate...' : 'Create Debate'}
              </Button>
            </div>

            {/* Authentication Warning */}
            {!authenticated && (
              <p className="text-xs md:text-sm text-amber-600 text-center">
                Please log in to create a debate
              </p>
            )}

            {/* Wallet Loading Warning */}
            {authenticated && !signerReady && (
              <p className="text-xs md:text-sm text-amber-600 text-center">
                Initializing wallet...
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
