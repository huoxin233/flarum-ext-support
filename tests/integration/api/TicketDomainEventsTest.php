<?php

/*
 * This file is part of linkrobins/support.
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

namespace LinkRobins\Support\Tests\integration\api;

use Carbon\Carbon;
use Flarum\Extend;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use LinkRobins\Support\Event\ReplyCreated;
use LinkRobins\Support\Event\TicketAssigned;
use LinkRobins\Support\Event\TicketCreated;
use LinkRobins\Support\Event\TicketDecided;
use LinkRobins\Support\Event\TicketStatusChanged;
use LinkRobins\Support\SupportTicket;
use PHPUnit\Framework\Attributes\Test;

class TicketDomainEventsTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    /** @var list<object> */
    public static array $dispatchedEvents = [];

    public function setUp(): void
    {
        parent::setUp();

        self::$dispatchedEvents = [];

        $this->extension('linkrobins-support');

        $this->extend(
            (new Extend\Event())
                ->listen(TicketCreated::class, fn ($e) => self::$dispatchedEvents[] = $e)
                ->listen(TicketStatusChanged::class, fn ($e) => self::$dispatchedEvents[] = $e)
                ->listen(TicketDecided::class, fn ($e) => self::$dispatchedEvents[] = $e)
                ->listen(TicketAssigned::class, fn ($e) => self::$dispatchedEvents[] = $e)
                ->listen(ReplyCreated::class, fn ($e) => self::$dispatchedEvents[] = $e)
        );

        $this->prepareDatabase([
            'users' => [
                $this->normalUser(), // id 2
                ['id' => 3, 'username' => 'staff1', 'email' => 'staff1@machine.local', 'is_email_confirmed' => 1, 'password' => 'password'],
            ],
            'groups' => [
                ['id' => 100, 'name_singular' => 'Staff', 'name_plural' => 'Staff', 'is_hidden' => 0],
            ],
            'group_user' => [
                ['user_id' => 3, 'group_id' => 100],
            ],
            'group_permission' => [
                ['group_id' => 100, 'permission' => 'lr-support.handle_tickets'],
                ['group_id' => 100, 'permission' => 'lr-support.staff'],
            ],
            'linkrobins_support_categories' => [
                ['id' => 1, 'name' => 'General', 'slug' => 'general', 'is_appeal' => 0, 'position' => 0, 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()],
                ['id' => 2, 'name' => 'Appeals', 'slug' => 'appeals', 'is_appeal' => 1, 'position' => 1, 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()],
            ],
        ]);
    }

    #[Test]
    public function creating_a_ticket_dispatches_ticket_created_event(): void
    {
        $response = $this->send(
            $this->request('POST', '/api/linkrobins-support-tickets', [
                'authenticatedAs' => 2,
                'json' => [
                    'data' => [
                        'attributes' => [
                            'subject' => 'Need Help',
                            'firstPost' => 'First message body',
                        ],
                        'relationships' => [
                            'category' => ['data' => ['type' => 'linkrobins-support-categories', 'id' => '1']],
                        ],
                    ],
                ],
            ])
        );

        $this->assertEquals(201, $response->getStatusCode());

        $createdEvents = array_filter(self::$dispatchedEvents, fn ($e) => $e instanceof TicketCreated);
        $this->assertCount(1, $createdEvents);

        /** @var TicketCreated $event */
        $event = reset($createdEvents);
        $this->assertEquals('Need Help', $event->ticket->subject);
        $this->assertEquals(2, $event->actor->id);
    }

    #[Test]
    public function updating_status_and_decision_dispatches_proper_events(): void
    {
        $ticketId = $this->database()->table('linkrobins_support_tickets')->insertGetId([
            'category_id' => 2,
            'user_id' => 2,
            'subject' => 'Appeal Ban',
            'status' => SupportTicket::STATUS_OPEN,
            'decision' => SupportTicket::DECISION_PENDING,
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now(),
        ]);

        self::$dispatchedEvents = [];

        $response = $this->send(
            $this->request('PATCH', "/api/linkrobins-support-tickets/$ticketId", [
                'authenticatedAs' => 3,
                'json' => [
                    'data' => [
                        'type' => 'linkrobins-support-tickets',
                        'id' => (string) $ticketId,
                        'attributes' => [
                            'status' => SupportTicket::STATUS_RESOLVED,
                            'decision' => SupportTicket::DECISION_ACCEPTED,
                        ],
                    ],
                ],
            ])
        );

        $this->assertEquals(200, $response->getStatusCode());

        $statusEvents = array_values(array_filter(self::$dispatchedEvents, fn ($e) => $e instanceof TicketStatusChanged));
        $this->assertCount(1, $statusEvents);
        $this->assertEquals(SupportTicket::STATUS_OPEN, $statusEvents[0]->oldStatus);
        $this->assertEquals(SupportTicket::STATUS_RESOLVED, $statusEvents[0]->newStatus);
        $this->assertEquals(3, $statusEvents[0]->actor->id);

        $decisionEvents = array_values(array_filter(self::$dispatchedEvents, fn ($e) => $e instanceof TicketDecided));
        $this->assertCount(1, $decisionEvents);
        $this->assertEquals(SupportTicket::DECISION_PENDING, $decisionEvents[0]->oldDecision);
        $this->assertEquals(SupportTicket::DECISION_ACCEPTED, $decisionEvents[0]->newDecision);
        $this->assertEquals(3, $decisionEvents[0]->actor->id);
    }
}
