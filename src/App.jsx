import React, { useState, useRef, useEffect } from 'react';
import {
  View, Panel, PanelHeader, Group, Button, Div, Title, Text,
  Caption, Snackbar, Avatar, SimpleCell, Separator,
  Headline, Subhead, PanelHeaderBack
} from '@vkontakte/vkui';
import {
  Icon28CameraOutline, Icon28RefreshOutline, Icon24ErrorCircleOutline,
  Icon28HistoryBackwardOutline, Icon28DeleteOutline, Icon24ChevronRight
} from '@vkontakte/icons';
import { analyzeFood } from './api/analyzeFood';
import { showNativeAd } from './utils/vkAds';
import { MACRO_COLORS, MACRO_LABELS } from './constants/prompts';
import { loadHistory, saveToHistory, removeFromHistory, updateHistoryItem, loadFitnessData, saveFitnessData } from './utils/vkStorage';
import {
  calcBMR, calcTDEE, calcTargetCalories, calcBMI, getBMICategory,
  calcIdealWeightRange, calcBodyFatEstimate, calcWaterIntake, calcMacroSplit,
  ACTIVITY_OPTIONS, GOAL_OPTIONS
} from './utils/fitnessCalc';

export default function App() {
  const [activePanel, setActivePanel] = useState('home');
  const [result, setResult] = useState(null);
  const [insult, setInsult] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [snackbar, setSnackbar] = useState(null);
  const [thinkingText, setThinkingText] = useState('');
  const [history, setHistory] = useState([]);
  const [isFromHistory, setIsFromHistory] = useState(false);
  const [editingCalories, setEditingCalories] = useState(false);
  const [editCaloriesValue, setEditCaloriesValue] = useState('');
  const [fitnessData, setFitnessData] = useState(null);
  const [fitnessForm, setFitnessForm] = useState({
    gender: 'male', age: '', weight: '', height: '', activity: 'moderate', goal: 'maintain'
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadHistory().then(setHistory);
    loadFitnessData().then((data) => {
      if (data) {
        setFitnessData(data);
        setFitnessForm(data);
      }
    });
  }, []);

  const showError = (text) => {
    setSnackbar(
      <Snackbar
        onClose={() => setSnackbar(null)}
        before={<Avatar size={24} style={{ background: '#e53935' }}><Icon24ErrorCircleOutline fill="#fff" width={16} height={16} /></Avatar>}
      >
        {text}
      </Snackbar>
    );
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setActivePanel('loading');

    try {
      setThinkingText('');
      showNativeAd();
      setIsFromHistory(false);

      const parsed = await analyzeFood(file, (reasoning) => {
        setThinkingText(reasoning);
      });

      if (parsed.is_food) {
        setResult(parsed);
        setActivePanel('food_result');
        const entry = {
          name: parsed.name,
          calories: parsed.calories,
          proteins: parsed.proteins,
          fats: parsed.fats,
          carbs: parsed.carbs,
        };
        saveToHistory(entry).then(setHistory);
      } else {
        setInsult(parsed.insult);
        setActivePanel('insult_result');
      }
    } catch (err) {
      console.error(err);
      showError('Ошибка анализа. Попробуйте другое фото.');
      setActivePanel('home');
    }

    e.target.value = '';
  };

  const handleReset = () => {
    setResult(null);
    setInsult('');
    setPhotoPreview(null);
    setIsFromHistory(false);
    setActivePanel('home');
  };

  const handleDeleteHistoryItem = async (e, id) => {
    e.stopPropagation();
    const updatedHistory = await removeFromHistory(id);
    setHistory(updatedHistory);
  };

  const handleSelectHistoryItem = (item) => {
    setResult(item);
    setPhotoPreview(null); // We don't store images in history for now (VK Storage limit)
    setIsFromHistory(true);
    setEditingCalories(false);
    setActivePanel('food_result');
  };

  const handleStartEditCalories = () => {
    setEditCaloriesValue(String(result.calories || 0));
    setEditingCalories(true);
  };

  const handleSaveFitness = async () => {
    const age = parseInt(fitnessForm.age, 10);
    const weight = parseFloat(fitnessForm.weight);
    const height = parseFloat(fitnessForm.height);
    if (!age || !weight || !height || age < 10 || age > 120 || weight < 20 || height < 100) {
      showError('Проверьте введённые данные');
      return;
    }
    const data = { ...fitnessForm, age, weight, height };
    await saveFitnessData(data);
    setFitnessData(data);
    setActivePanel('fitness_results');
  };

  const fitnessStats = React.useMemo(() => {
    if (!fitnessData) return null;
    const { weight, height, age, gender, activity, goal } = fitnessData;
    const bmr = calcBMR({ weight, height, age, gender });
    const tdee = calcTDEE(bmr, activity);
    const targetCalories = calcTargetCalories(tdee, goal);
    const bmi = calcBMI(weight, height);
    const bmiCategory = getBMICategory(bmi);
    const idealWeight = calcIdealWeightRange(height);
    const bodyFat = calcBodyFatEstimate(bmi, age, gender);
    const water = calcWaterIntake(weight, activity);
    const macros = calcMacroSplit(targetCalories, goal);
    return { bmr, tdee, targetCalories, bmi, bmiCategory, idealWeight, bodyFat, water, macros };
  }, [fitnessData]);

  const handleSaveCalories = async () => {
    const newCalories = parseInt(editCaloriesValue, 10);
    if (isNaN(newCalories) || newCalories < 0) {
      showError('Введите корректное число калорий');
      return;
    }
    const updated = { ...result, calories: newCalories };
    setResult(updated);
    setEditingCalories(false);
    if (result.id) {
      const updatedHistory = await updateHistoryItem(result.id, { calories: newCalories });
      setHistory(updatedHistory);
    }
  };

  const maxMacro = React.useMemo(() => result
    ? Math.max(result.proteins || 0, result.fats || 0, result.carbs || 0, result.fiber || 0, result.sugar || 0, 1)
    : 1, [result]);

  const groupedHistory = React.useMemo(() => history.reduce((acc, item) => {
    const date = new Date(item.date).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    if (!acc[date]) {
      acc[date] = { items: [], totalCalories: 0 };
    }
    acc[date].items.push(item);
    acc[date].totalCalories += item.calories || 0;
    return acc;
  }, {}), [history]);

  return (
    <View activePanel={activePanel}>
      {/* HOME */}
      <Panel id="home">
        <PanelHeader>Нейросканер еды</PanelHeader>
        <Group>
          <Div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: 'linear-gradient(135deg, #FF6B6B, #FFA94D)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 48
            }}>
              🍔
            </div>
            <Title level="1" style={{ marginBottom: 8 }}>Нейросканер еды</Title>
            <Text style={{ color: 'var(--vkui--color_text_secondary)', marginBottom: 24 }}>
              Сфотографируй еду — узнай калории за секунды
            </Text>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <Button
              size="l"
              stretched
              before={<Icon28CameraOutline />}
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'linear-gradient(135deg, #FF6B6B, #FFA94D)',
                borderRadius: 12, marginBottom: 16
              }}
            >
              Анализировать фото 📺
            </Button>

            {history.length > 0 && (
              <Button
                size="l"
                stretched
                mode="secondary"
                before={<Icon28HistoryBackwardOutline />}
                onClick={() => setActivePanel('history')}
                style={{ borderRadius: 12, marginBottom: 16 }}
              >
                История сканирований
              </Button>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              {['⚡ Быстро', '🎯 Точно', '🤖 ИИ'].map((t) => (
                <span key={t} style={{
                  background: 'var(--vkui--color_background_secondary)', borderRadius: 20,
                  padding: '6px 14px', fontSize: 13, color: 'var(--vkui--color_text_secondary)'
                }}>{t}</span>
              ))}
            </div>
          </Div>
        </Group>

        <Caption
          level="2"
          style={{ textAlign: 'center', color: 'var(--vkui--color_text_tertiary)', padding: '0 20px 20px' }}
        >
          ⚠️ ИИ может ошибаться. Данные являются приблизительными и не заменяют консультацию диетолога.
        </Caption>
        {snackbar}
      </Panel>

      {/* LOADING */}
      <Panel id="loading">
        <PanelHeader>Анализ...</PanelHeader>
        <Group>
          <Div style={{ textAlign: 'center', padding: '60px 20px' }}>
            {photoPreview && (
              <div style={{
                width: 150, height: 150, borderRadius: 20, overflow: 'hidden',
                margin: '0 auto 24px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}>
                <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div style={{
              width: 48, height: 48, margin: '20px auto',
              border: '4px solid var(--vkui--color_background_secondary)', borderTopColor: '#FF6B6B',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <Title level="2" style={{ marginBottom: 8 }}>Анализируем фото...</Title>
            <Text style={{ color: 'var(--vkui--color_text_secondary)' }}>
              ИИ определяет состав и калорийность
            </Text>
            {thinkingText && (
              <div style={{
                marginTop: 16, padding: '12px 16px',
                background: 'var(--vkui--color_background_secondary)', borderRadius: 12,
                maxHeight: 120, overflow: 'auto',
                textAlign: 'left'
              }}>
                <Caption level="2" style={{ color: 'var(--vkui--color_text_tertiary)', marginBottom: 4 }}>🧠 ИИ думает:</Caption>
                <Text style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)', lineHeight: '1.4' }}>
                  {thinkingText.length > 200 ? '...' + thinkingText.slice(-200) : thinkingText}
                </Text>
              </div>
            )}
            <Caption level="2" style={{ color: 'var(--vkui--color_text_tertiary)', marginTop: 16 }}>
              📺 Пока показываем рекламу — спасибо за поддержку!
            </Caption>
          </Div>
        </Group>
      </Panel>

      {/* FOOD RESULT */}
      <Panel id="food_result">
        <PanelHeader
          before={isFromHistory ? <PanelHeaderBack onClick={() => setActivePanel('history')} /> : null}
        >
          Результат
        </PanelHeader>
        {result && (
          <>
            {photoPreview && (
              <div style={{
                position: 'relative', height: 220, overflow: 'hidden'
              }}>
                <img src={photoPreview} alt="" style={{
                  width: '100%', height: '100%', objectFit: 'cover'
                }} />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
                  background: 'linear-gradient(transparent, var(--vkui--color_background_content))'
                }} />
                <div style={{
                  position: 'absolute', bottom: 12, left: 16, right: 16
                }}>
                  <Title level="1" style={{ color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                    {result.name}
                  </Title>
                </div>
              </div>
            )}

            <Group>
              <Div>
                <div style={{
                  textAlign: 'center', padding: '16px 0',
                  background: 'linear-gradient(135deg, #FF6B6B15, #FFA94D15)',
                  borderRadius: 16, marginBottom: 16
                }}>
                  {editingCalories ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 16px' }}>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={editCaloriesValue}
                        onChange={(e) => setEditCaloriesValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveCalories()}
                        autoFocus
                        style={{
                          fontSize: 36, fontWeight: 800, color: '#FF6B6B',
                          background: 'var(--vkui--color_background_secondary)',
                          border: '2px solid #FF6B6B', borderRadius: 12,
                          textAlign: 'center', width: 120, padding: '4px 8px',
                          outline: 'none'
                        }}
                      />
                      <Button size="s" style={{ background: '#51CF66', borderRadius: 10 }} onClick={handleSaveCalories}>
                        Сохранить
                      </Button>
                      <Button size="s" mode="secondary" style={{ borderRadius: 10 }} onClick={() => setEditingCalories(false)}>
                        Отмена
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={isFromHistory ? handleStartEditCalories : undefined}
                      style={{ cursor: isFromHistory ? 'pointer' : 'default' }}
                    >
                      <div style={{ fontSize: 42, fontWeight: 800, color: '#FF6B6B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        {result.calories}
                        {isFromHistory && (
                          <span style={{ fontSize: 18, opacity: 0.5 }}>✏️</span>
                        )}
                      </div>
                    </div>
                  )}
                  <Subhead style={{ color: 'var(--vkui--color_text_secondary)' }}>
                    {isFromHistory ? 'ккал на порцию · нажмите чтобы изменить' : 'ккал на порцию'}
                  </Subhead>
                </div>

                <Headline weight="2" style={{ marginBottom: 12 }}>Макронутриенты</Headline>
                {['proteins', 'fats', 'carbs', 'fiber', 'sugar'].map((key) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 14 }}>{MACRO_LABELS[key]}</Text>
                      <Text style={{ fontSize: 14, fontWeight: 600 }}>{result[key] ?? 0} г</Text>
                    </div>
                    <div style={{
                      height: 8, borderRadius: 4, background: 'var(--vkui--color_background_secondary)', overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${((result[key] ?? 0) / maxMacro) * 100}%`,
                        background: MACRO_COLORS[key],
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                ))}
              </Div>

              <Separator />

              {result.ingredients?.length > 0 && (
                <Div>
                  <Headline weight="2" style={{ marginBottom: 12 }}>Ингредиенты</Headline>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {result.ingredients.map((ing, i) => (
                      <span key={i} style={{
                        background: 'var(--vkui--color_background_secondary)', borderRadius: 20,
                        padding: '6px 14px', fontSize: 13, color: 'var(--vkui--color_text_primary)'
                      }}>{ing}</span>
                    ))}
                  </div>
                </Div>
              )}

              {result.health_tip && (
                <>
                  <Separator />
                  <SimpleCell
                    before={<Avatar size={36} style={{ background: '#E8F5E9' }}>💡</Avatar>}
                    subtitle="Совет"
                    multiline
                  >
                    {result.health_tip}
                  </SimpleCell>
                </>
              )}
            </Group>

            <Caption level="2" style={{ textAlign: 'center', color: 'var(--vkui--color_text_tertiary)', padding: '0 20px 8px' }}>
              ⚠️ ИИ может ошибаться. Данные приблизительные.
            </Caption>

            <Div>
              {history.length > 0 && (
                <Button
                  size="l"
                  stretched
                  mode="secondary"
                  before={<Icon28HistoryBackwardOutline />}
                  onClick={() => setActivePanel('history')}
                  style={{ borderRadius: 12, marginBottom: 12 }}
                >
                  История сканирований
                </Button>
              )}
              <Button
                size="l" stretched mode="secondary"
                before={<Icon28RefreshOutline />}
                onClick={handleReset}
                style={{ borderRadius: 12 }}
              >
                Сканировать ещё
              </Button>
            </Div>
          </>
        )}
        {snackbar}
      </Panel>

      {/* INSULT RESULT */}
      <Panel id="insult_result">
        <PanelHeader>Это не еда!</PanelHeader>
        <Group>
          <Div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 80, marginBottom: 20 }}>🤖</div>
            <Title level="2" style={{ marginBottom: 16 }}>Это не еда!</Title>

            <div style={{
              background: 'linear-gradient(135deg, #FF6B6B10, #FFA94D10)',
              borderRadius: 16, padding: 20, marginBottom: 20,
              borderLeft: '4px solid #FF6B6B'
            }}>
              <Text style={{ fontSize: 16, lineHeight: '1.5', fontStyle: 'italic' }}>
                «{insult}»
              </Text>
            </div>

            {photoPreview && (
              <div style={{
                width: 120, height: 120, borderRadius: 16, overflow: 'hidden',
                margin: '0 auto 20px', opacity: 0.6,
                border: '3px dashed var(--vkui--color_icon_tertiary)'
              }}>
                <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <Button
              size="l" stretched
              before={<Icon28RefreshOutline />}
              onClick={handleReset}
              style={{
                background: 'linear-gradient(135deg, #FF6B6B, #FFA94D)',
                borderRadius: 12
              }}
            >
              Попробовать ещё раз
            </Button>
          </Div>
        </Group>

        <Caption level="2" style={{ textAlign: 'center', color: 'var(--vkui--color_text_tertiary)', padding: '0 20px 20px' }}>
          ⚠️ ИИ может ошибаться. Данные приблизительные.
        </Caption>
        {snackbar}
      </Panel>

      {/* HISTORY */}
      <Panel id="history">
        <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('home')} />}>
          История
        </PanelHeader>

        <Group>
          <Div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="l" stretched mode="secondary"
              onClick={() => setActivePanel('fitness_form')}
              style={{ borderRadius: 12 }}
            >
              {fitnessData ? '⚙️ Редактировать данные' : '🏋️ Фитнес калькулятор'}
            </Button>
            {fitnessData && (
              <Button
                size="l" stretched
                onClick={() => setActivePanel('fitness_results')}
                style={{ borderRadius: 12, background: 'linear-gradient(135deg, #51CF66, #20C997)' }}
              >
                📊 Мои показатели
              </Button>
            )}
          </Div>
        </Group>

        {Object.keys(groupedHistory).length === 0 ? (
          <Div style={{ textAlign: 'center', marginTop: 40 }}>
            <Text style={{ color: '#888' }}>История пока пуста</Text>
          </Div>
        ) : (
          Object.entries(groupedHistory).map(([date, data]) => {
            const caloriePercent = fitnessStats ? Math.round((data.totalCalories / fitnessStats.targetCalories) * 100) : null;
            const overLimit = caloriePercent !== null && caloriePercent > 100;
            return (
              <Group key={date} header={
                <Div style={{ paddingBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Headline weight="2">{date}</Headline>
                    <Caption level="1" style={{ color: '#FF6B6B', fontWeight: 600 }}>
                      {data.totalCalories} ккал
                    </Caption>
                  </div>
                  {fitnessStats && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Caption level="2" style={{ color: 'var(--vkui--color_text_secondary)' }}>
                          {data.totalCalories} / {fitnessStats.targetCalories} ккал
                        </Caption>
                        <Caption level="2" style={{
                          color: overLimit ? '#E53935' : '#51CF66', fontWeight: 600
                        }}>
                          {caloriePercent}%
                        </Caption>
                      </div>
                      <div style={{
                        height: 6, borderRadius: 3, background: 'var(--vkui--color_background_secondary)', overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${Math.min(caloriePercent, 100)}%`,
                          background: overLimit
                            ? 'linear-gradient(90deg, #FFA94D, #E53935)'
                            : 'linear-gradient(90deg, #51CF66, #20C997)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  )}
                </Div>
              }>
                {data.items.map((item) => (
                  <SimpleCell
                    key={item.id}
                    onClick={() => handleSelectHistoryItem(item)}
                    after={
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Text style={{ marginRight: 8, color: '#888' }}>{item.calories} ккал</Text>
                        <Icon28DeleteOutline
                          width={24} height={24}
                          style={{ color: '#E53935' }}
                          onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                        />
                        <Icon24ChevronRight style={{ color: '#BBB' }} />
                      </div>
                    }
                    subtitle={`${item.proteins}П · ${item.fats}Ж · ${item.carbs}У`}
                  >
                    {item.name}
                  </SimpleCell>
                ))}
              </Group>
            );
          })
        )}
      </Panel>

      {/* FITNESS FORM */}
      <Panel id="fitness_form">
        <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('history')} />}>
          Фитнес калькулятор
        </PanelHeader>
        <Group>
          <Div>
            <div style={{
              textAlign: 'center', marginBottom: 20, padding: '16px 0',
              background: 'linear-gradient(135deg, #51CF6615, #20C99715)', borderRadius: 16
            }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🏋️</div>
              <Title level="2">Ваши параметры</Title>
              <Caption level="2" style={{ color: 'var(--vkui--color_text_secondary)', marginTop: 4 }}>
                Заполните для расчёта нормы калорий
              </Caption>
            </div>

            {/* Gender */}
            <Headline weight="2" style={{ marginBottom: 8 }}>Пол</Headline>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[{ v: 'male', l: '👨 Мужской' }, { v: 'female', l: '👩 Женский' }].map(({ v, l }) => (
                <Button
                  key={v} size="l" stretched
                  mode={fitnessForm.gender === v ? 'primary' : 'secondary'}
                  onClick={() => setFitnessForm(f => ({ ...f, gender: v }))}
                  style={{
                    borderRadius: 12,
                    ...(fitnessForm.gender === v ? { background: 'linear-gradient(135deg, #51CF66, #20C997)' } : {})
                  }}
                >
                  {l}
                </Button>
              ))}
            </div>

            {/* Age, Weight, Height */}
            {[
              { key: 'age', label: 'Возраст', placeholder: '25', suffix: 'лет' },
              { key: 'weight', label: 'Вес', placeholder: '70', suffix: 'кг' },
              { key: 'height', label: 'Рост', placeholder: '175', suffix: 'см' },
            ].map(({ key, label, placeholder, suffix }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <Headline weight="2" style={{ marginBottom: 8 }}>{label}</Headline>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={fitnessForm[key]}
                    onChange={(e) => setFitnessForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{
                      flex: 1, fontSize: 18, padding: '12px 16px',
                      background: 'var(--vkui--color_background_secondary)',
                      border: '2px solid transparent', borderRadius: 12,
                      color: 'var(--vkui--color_text_primary)', outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#51CF66'}
                    onBlur={(e) => e.target.style.borderColor = 'transparent'}
                  />
                  <Text style={{ color: 'var(--vkui--color_text_secondary)', minWidth: 30 }}>{suffix}</Text>
                </div>
              </div>
            ))}

            {/* Activity */}
            <Headline weight="2" style={{ marginBottom: 8 }}>Уровень активности</Headline>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {ACTIVITY_OPTIONS.map(({ value, label }) => (
                <div
                  key={value}
                  onClick={() => setFitnessForm(f => ({ ...f, activity: value }))}
                  style={{
                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                    background: fitnessForm.activity === value
                      ? 'linear-gradient(135deg, #51CF6620, #20C99720)'
                      : 'var(--vkui--color_background_secondary)',
                    border: fitnessForm.activity === value ? '2px solid #51CF66' : '2px solid transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <Text style={{
                    fontSize: 14,
                    color: fitnessForm.activity === value ? '#51CF66' : 'var(--vkui--color_text_primary)',
                    fontWeight: fitnessForm.activity === value ? 600 : 400
                  }}>
                    {label}
                  </Text>
                </div>
              ))}
            </div>

            {/* Goal */}
            <Headline weight="2" style={{ marginBottom: 8 }}>Цель</Headline>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {GOAL_OPTIONS.map(({ value, label }) => (
                <Button
                  key={value} size="l" stretched
                  mode={fitnessForm.goal === value ? 'primary' : 'secondary'}
                  onClick={() => setFitnessForm(f => ({ ...f, goal: value }))}
                  style={{
                    borderRadius: 12,
                    ...(fitnessForm.goal === value ? { background: 'linear-gradient(135deg, #51CF66, #20C997)' } : {})
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>

            <Button
              size="l" stretched
              onClick={handleSaveFitness}
              style={{ borderRadius: 12, background: 'linear-gradient(135deg, #51CF66, #20C997)' }}
            >
              Рассчитать
            </Button>
          </Div>
        </Group>
      </Panel>

      {/* FITNESS RESULTS */}
      <Panel id="fitness_results">
        <PanelHeader before={<PanelHeaderBack onClick={() => setActivePanel('history')} />}>
          Мои показатели
        </PanelHeader>
        {fitnessStats && fitnessData && (
          <Group>
            <Div>
              {/* BMI Card */}
              <div style={{
                textAlign: 'center', padding: 20,
                background: 'linear-gradient(135deg, #51CF6615, #20C99715)',
                borderRadius: 16, marginBottom: 16
              }}>
                <Caption level="2" style={{ color: 'var(--vkui--color_text_secondary)' }}>Индекс массы тела (ИМТ)</Caption>
                <div style={{ fontSize: 48, fontWeight: 800, color: fitnessStats.bmiCategory.color, margin: '8px 0' }}>
                  {fitnessStats.bmi}
                </div>
                <div style={{
                  display: 'inline-block', padding: '4px 16px', borderRadius: 20,
                  background: fitnessStats.bmiCategory.color + '20',
                  color: fitnessStats.bmiCategory.color, fontWeight: 600, fontSize: 14
                }}>
                  {fitnessStats.bmiCategory.label}
                </div>
              </div>

              {/* BMI Scale */}
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  height: 8, borderRadius: 4, overflow: 'hidden',
                  background: 'linear-gradient(90deg, #74C0FC 0%, #51CF66 30%, #51CF66 45%, #FFA94D 65%, #E53935 100%)'
                }}>
                </div>
                <div style={{ position: 'relative', height: 20 }}>
                  <div style={{
                    position: 'absolute',
                    left: `${Math.min(Math.max(((fitnessStats.bmi - 15) / 30) * 100, 0), 100)}%`,
                    transform: 'translateX(-50%)', fontSize: 16, top: 0
                  }}>
                    ▼
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Caption level="2" style={{ color: '#888' }}>15</Caption>
                  <Caption level="2" style={{ color: '#888' }}>18.5</Caption>
                  <Caption level="2" style={{ color: '#888' }}>25</Caption>
                  <Caption level="2" style={{ color: '#888' }}>30</Caption>
                  <Caption level="2" style={{ color: '#888' }}>45</Caption>
                </div>
              </div>

              <Separator style={{ margin: '8px 0 16px' }} />

              {/* Daily Calories Target */}
              <div style={{
                textAlign: 'center', padding: 20,
                background: 'linear-gradient(135deg, #FF6B6B15, #FFA94D15)',
                borderRadius: 16, marginBottom: 16
              }}>
                <Caption level="2" style={{ color: 'var(--vkui--color_text_secondary)' }}>Ваша норма калорий</Caption>
                <div style={{ fontSize: 42, fontWeight: 800, color: '#FF6B6B', margin: '8px 0' }}>
                  {fitnessStats.targetCalories}
                </div>
                <Subhead style={{ color: 'var(--vkui--color_text_secondary)' }}>ккал / день</Subhead>
                <Caption level="2" style={{ color: 'var(--vkui--color_text_tertiary)', marginTop: 8 }}>
                  Базовый обмен: {fitnessStats.bmr} ккал · TDEE: {fitnessStats.tdee} ккал
                </Caption>
              </div>

              <Separator style={{ margin: '8px 0 16px' }} />

              {/* Stats Grid */}
              <Headline weight="2" style={{ marginBottom: 12 }}>Подробные показатели</Headline>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Идеальный вес', value: `${fitnessStats.idealWeight.min}–${fitnessStats.idealWeight.max} кг`, color: '#51CF66' },
                  { label: '% жира (оценка)', value: `${fitnessStats.bodyFat}%`, color: '#FFA94D' },
                  { label: 'Вода в день', value: `${fitnessStats.water} мл`, color: '#74C0FC' },
                  { label: 'Базовый обмен', value: `${fitnessStats.bmr} ккал`, color: '#E599F7' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    padding: 14, borderRadius: 14,
                    background: color + '10', borderLeft: `4px solid ${color}`
                  }}>
                    <Caption level="2" style={{ color: 'var(--vkui--color_text_secondary)' }}>{label}</Caption>
                    <Text style={{ fontSize: 18, fontWeight: 700, color, marginTop: 4 }}>{value}</Text>
                  </div>
                ))}
              </div>

              <Separator style={{ margin: '8px 0 16px' }} />

              {/* Recommended Macros */}
              <Headline weight="2" style={{ marginBottom: 12 }}>Рекомендуемые макронутриенты</Headline>
              {[
                { label: 'Белки', value: fitnessStats.macros.proteins, color: MACRO_COLORS.proteins },
                { label: 'Жиры', value: fitnessStats.macros.fats, color: MACRO_COLORS.fats },
                { label: 'Углеводы', value: fitnessStats.macros.carbs, color: MACRO_COLORS.carbs },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 14 }}>{label}</Text>
                    <Text style={{ fontSize: 14, fontWeight: 600 }}>{value} г</Text>
                  </div>
                  <div style={{
                    height: 8, borderRadius: 4, background: 'var(--vkui--color_background_secondary)', overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 4, background: color,
                      width: `${(value / Math.max(fitnessStats.macros.proteins, fitnessStats.macros.fats, fitnessStats.macros.carbs)) * 100}%`,
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>
              ))}

              <Separator style={{ margin: '16px 0' }} />

              <Button
                size="l" stretched mode="secondary"
                onClick={() => setActivePanel('fitness_form')}
                style={{ borderRadius: 12 }}
              >
                ⚙️ Изменить параметры
              </Button>
            </Div>
          </Group>
        )}
      </Panel>
    </View>
  );
}
