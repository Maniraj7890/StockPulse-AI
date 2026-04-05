function round(value, decimals = 2) {
  return Number((value ?? 0).toFixed(decimals));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildBucket() {
  return {
    total: 0,
    success: 0,
    failure: 0,
    partial: 0,
    averageConfidence: 0,
    reputationScore: 0,
    accuracy: 0,
  };
}

function finalizeBucket(bucket) {
  const total = bucket.total || 0;
  const completed = bucket.success + bucket.failure + bucket.partial;
  const weightedSuccess = bucket.success + bucket.partial * 0.5;

  return {
    ...bucket,
    averageConfidence: total ? round(bucket.averageConfidence / total) : 0,
    accuracy: completed ? round((weightedSuccess / completed) * 100) : 0,
    reputationScore: completed ? round((weightedSuccess / completed) * 100) : 0,
  };
}

function updateBucket(bucket, item) {
  bucket.total += 1;
  bucket.averageConfidence += item?.confidence ?? 0;
  if (item.outcome === 'SUCCESS') bucket.success += 1;
  else if (item.outcome === 'FAILURE') bucket.failure += 1;
  else if (item.outcome === 'PARTIAL') bucket.partial += 1;
}

export function buildLearningProfile(history = []) {
  const setupAccuracy = {};
  const directionAccuracy = {};
  const symbolAccuracy = {};
  const setupFamilyAccuracy = {};
  const confidenceBucketAccuracy = {
    '0-30': buildBucket(),
    '30-60': buildBucket(),
    '60-100': buildBucket(),
  };

  const evaluatedRows = (history ?? []).filter(
    (item) =>
      item?.outcome &&
      item.outcome !== 'PENDING' &&
      (item?.direction === 'UP' || item?.direction === 'DOWN' || item?.direction === 'NO_EDGE'),
  );

  evaluatedRows.forEach((item) => {
    const setupKey = item.setupType ?? 'No Trade';
    const directionKey = item.direction ?? 'NO_EDGE';
    const familyKey = item.setupFamily ?? 'mixed sideways';
    const bucketKey = item.confidenceBucket ?? '30-60';

    setupAccuracy[setupKey] ??= buildBucket();
    directionAccuracy[directionKey] ??= buildBucket();
    symbolAccuracy[item.symbol] ??= buildBucket();
    setupFamilyAccuracy[familyKey] ??= buildBucket();

    updateBucket(setupAccuracy[setupKey], item);
    updateBucket(directionAccuracy[directionKey], item);
    updateBucket(symbolAccuracy[item.symbol], item);
    updateBucket(setupFamilyAccuracy[familyKey], item);
    updateBucket(confidenceBucketAccuracy[bucketKey], item);
  });

  const totalSignals = evaluatedRows.length;
  const weightedSuccess = evaluatedRows.reduce((sum, item) => {
    if (item.outcome === 'SUCCESS') return sum + 1;
    if (item.outcome === 'PARTIAL') return sum + 0.5;
    return sum;
  }, 0);
  const overallAccuracy = totalSignals ? round((weightedSuccess / totalSignals) * 100) : 0;

  return {
    overallAccuracy,
    setupAccuracy: Object.fromEntries(
      Object.entries(setupAccuracy).map(([key, bucket]) => [key, finalizeBucket(bucket)]),
    ),
    directionAccuracy: Object.fromEntries(
      Object.entries(directionAccuracy).map(([key, bucket]) => [key, finalizeBucket(bucket)]),
    ),
    symbolAccuracy: Object.fromEntries(
      Object.entries(symbolAccuracy).map(([key, bucket]) => [key, finalizeBucket(bucket)]),
    ),
    setupFamilyAccuracy: Object.fromEntries(
      Object.entries(setupFamilyAccuracy).map(([key, bucket]) => [key, finalizeBucket(bucket)]),
    ),
    confidenceBucketAccuracy: Object.fromEntries(
      Object.entries(confidenceBucketAccuracy).map(([key, bucket]) => [key, finalizeBucket(bucket)]),
    ),
  };
}

export function adjustPredictionWithLearning(basePrediction = {}, learningProfile = {}) {
  const setupStats = learningProfile?.setupAccuracy?.[basePrediction.setupType];
  const directionStats = learningProfile?.directionAccuracy?.[basePrediction.direction];
  const symbolStats = learningProfile?.symbolAccuracy?.[basePrediction.symbol];
  const familyStats = learningProfile?.setupFamilyAccuracy?.[basePrediction.setupFamily];
  const bucketStats = learningProfile?.confidenceBucketAccuracy?.[basePrediction.confidenceBucket];
  const overallAccuracy = learningProfile?.overallAccuracy ?? 0;

  const adjustments = [];
  let totalAdjustment = 0;

  if (setupStats?.total >= 3) {
    if (setupStats.accuracy >= 66) {
      totalAdjustment += 2.5;
      adjustments.push('This setup type has been historically strong.');
    } else if (setupStats.accuracy <= 46) {
      totalAdjustment -= 2.5;
      adjustments.push('This setup type has been historically weak.');
    }
  }

  if (familyStats?.total >= 4) {
    if (familyStats.accuracy >= 68) {
      totalAdjustment += 3.5;
      adjustments.push('This setup family has been performing well.');
    } else if (familyStats.accuracy <= 45) {
      totalAdjustment -= 3.5;
      adjustments.push('This setup family has been underperforming.');
    }
  }

  if (directionStats?.total >= 4) {
    if (directionStats.accuracy >= 64) {
      totalAdjustment += 1.5;
      adjustments.push(`${basePrediction.direction} signals have held up well recently.`);
    } else if (directionStats.accuracy <= 44) {
      totalAdjustment -= 1.5;
      adjustments.push(`${basePrediction.direction} signals have recently been less reliable.`);
    }
  }

  if (symbolStats?.total >= 3) {
    if (symbolStats.accuracy >= 68) {
      totalAdjustment += 1.5;
      adjustments.push(`${basePrediction.symbol} has been historically reliable.`);
    } else if (symbolStats.accuracy <= 42) {
      totalAdjustment -= 2.5;
      adjustments.push(`${basePrediction.symbol} has shown weaker follow-through historically.`);
    }
  }

  if (bucketStats?.total >= 4) {
    if ((basePrediction.confidence ?? 0) >= 60 && bucketStats.accuracy < 58) {
      totalAdjustment -= 2;
      adjustments.push('Very high confidence has not been performing as well as expected.');
    } else if ((basePrediction.confidence ?? 0) < 60 && bucketStats.accuracy >= 64) {
      totalAdjustment += 1.5;
      adjustments.push('Lower-confidence setups have recently done better than expected.');
    }
  }

  if (overallAccuracy >= 65) {
    totalAdjustment += 0.5;
  } else if (overallAccuracy > 0 && overallAccuracy <= 48) {
    totalAdjustment -= 0.5;
  }

  const learningAdjustment = clamp(round(totalAdjustment, 1), -8, 8);
  const adjustedConfidence = clamp(round((basePrediction.confidence ?? 0) + learningAdjustment), 0, 100);
  const learningReason =
    adjustments[0] ??
    (learningAdjustment > 0
      ? 'Historical tracking gives this setup a small confidence boost.'
      : learningAdjustment < 0
        ? 'Historical tracking reduces confidence slightly for this setup.'
        : 'Limited history keeps confidence close to the base engine.');

  const learningBadge =
    learningAdjustment >= 4
      ? 'Historically strong setup'
      : learningAdjustment <= -4
        ? 'Historically weak setup'
        : 'Neutral history';

  return {
    ...basePrediction,
    confidence: adjustedConfidence,
    confidenceBucket:
      adjustedConfidence >= 60 ? '60-100' : adjustedConfidence >= 30 ? '30-60' : '0-30',
    learningAdjustment,
    learningReason,
    learningBadge,
    rankingScore: (basePrediction.rankingScore ?? 0) + learningAdjustment * 2.5,
    modelHitRate:
      basePrediction.modelHitRate != null
        ? clamp(round(basePrediction.modelHitRate + learningAdjustment * 0.7), 30, 85)
        : basePrediction.modelHitRate,
    noClearEdge:
      basePrediction.direction !== 'NONE' &&
      adjustedConfidence < 58 &&
      learningAdjustment < 0
        ? true
        : basePrediction.noClearEdge,
  };
}
